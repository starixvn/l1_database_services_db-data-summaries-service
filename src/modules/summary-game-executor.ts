import { AggregateOptions, AnyBulkWriteOperation, BulkWriteOptions, ChangeStreamNameSpace, Collection, Document, MongoClient } from "mongodb";
import { logger } from "../loggers";
import { SummaryPipelineFactory } from "../types/pipeline-factory";
import { SummaryConfig } from "../types/summary-config";
import { getCollection } from "../utils/mongodb-utils";
import { SummaryRoundInitiator, SummaryRoundInitiatorEvents } from "./summary-round-initiator";

const BULK_WRITE_THRESHOLD = 1_000;

export class SummaryGameExecutor<TConfig extends SummaryConfig> {
    private readonly emitters: Set<SummaryRoundInitiator> = new Set();
    private summaryFlag: Map<string, boolean> = new Map();

    constructor(private readonly mongoClient: MongoClient, private readonly roundSummariesNamespace: ChangeStreamNameSpace, private readonly pipelineFactory: SummaryPipelineFactory<TConfig>) {
        this.selfBound();

        this.mongoClient = mongoClient;
        this.roundSummariesNamespace = roundSummariesNamespace;
        this.pipelineFactory = pipelineFactory;
    }

    get className(): string {
        return this.constructor.name;
    }

    protected selfBound() {
        this.execute = this.execute.bind(this);
    }

    protected getPipeline(summaryConfig: TConfig) {
        return this.pipelineFactory(summaryConfig);
    }

    protected getCollection(namespace: ChangeStreamNameSpace) {
        return getCollection(this.mongoClient, namespace);
    }

    protected async execute(summaryConfig: TConfig) {
        const { gameConfigs } = summaryConfig;
        const { gameId, name } = gameConfigs;

        const flag = `#${gameId}.${name}`;
        if (this.summaryFlag.get(flag)) {
            logger.logWarning(this.className, `Summary process #${gameId} - ${name} is running!`);
            return;
        }

        try {
            this.summaryFlag.set(flag, true);
            await this.runSummary(summaryConfig);
        } finally {
            this.summaryFlag.set(flag, false);
            logger.logDebug("", { title: this.className, subject: flag });
        }
    }

    protected async runSummary(summaryConfig: TConfig) {
        const aggregateOptions: AggregateOptions = { allowDiskUse: true };

        const {
            gameConfigs: { name },
            coll: { round },
        } = summaryConfig;

        const roundCollection = this.getCollection(round);
        const pipeline = this.getPipeline(summaryConfig);

        const filterStage: Document = {
            $match: {
                gameId: { $ne: null },
                currency: { $ne: null },
                operatorId: { $ne: null },
                time: { $ne: null },
                roundId: { $ne: null },
            },
        };
        const mergeStage: Document = {
            $merge: {
                into: this.roundSummariesNamespace,
                on: ["gameId", "currency", "operatorId", "time", "roundId"],
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        };

        pipeline.push(filterStage);
        pipeline.push(mergeStage);

        try {
            await roundCollection.aggregate(pipeline, aggregateOptions).tryNext();
            await this.updateFlag(summaryConfig);
        } catch (error: unknown) {
            this.handleError(error, `executeMergeAggregate - ${name}`);
        }
    }

    protected async updateFlag(summaryConfig: TConfig) {
        const {
            gameConfigs: { gameId, name },
            coll: { round },
            calc: { roundId: roundIdCalc },
        } = summaryConfig;

        const roundSummariesCollection = this.getCollection(this.roundSummariesNamespace);
        const roundCollection = this.getCollection(round);

        let gameRoundFlagUpdates: AnyBulkWriteOperation[] = [];
        let summaryFlagRemoves: AnyBulkWriteOperation[] = [];

        const insertedCursor = roundSummariesCollection.find({ "__archive.inserted": true, gameId }, { projection: { _id: 1, roundId: 1, time: 1, players: 1 } });
        const warmingTime = new Date(Date.now() - 3_600_000);

        for await (const document of insertedCursor) {
            const { _id, roundId, time, players } = document;

            if (time <= warmingTime) {
                gameRoundFlagUpdates.push({ updateMany: { filter: { $expr: { $eq: [roundIdCalc, roundId] } }, update: { $set: { "__archive.summarized": true } } } });
            }

            if (players instanceof Array && players.length > 0) {
                summaryFlagRemoves.push({ updateOne: { filter: { _id }, update: { $unset: { "__archive.inserted": 1 } } } });
            } else {
                summaryFlagRemoves.push({ deleteOne: { filter: { _id } } });
            }

            if (gameRoundFlagUpdates.length >= BULK_WRITE_THRESHOLD || summaryFlagRemoves.length >= BULK_WRITE_THRESHOLD) {
                await this.executeBulkWrite(roundCollection, gameRoundFlagUpdates, name);
                await this.executeBulkWrite(roundSummariesCollection, summaryFlagRemoves, name);

                gameRoundFlagUpdates = [];
                summaryFlagRemoves = [];
            }
        }

        if (gameRoundFlagUpdates.length > 0) {
            await this.executeBulkWrite(roundCollection, gameRoundFlagUpdates, name);
        }

        if (summaryFlagRemoves.length > 0) {
            await this.executeBulkWrite(roundSummariesCollection, summaryFlagRemoves, name);
        }
    }

    private async executeBulkWrite(collection: Collection, bulkWriteOperations: AnyBulkWriteOperation[], info: string) {
        try {
            const bulkWriteOptions: BulkWriteOptions = { ordered: false };
            const bulkWriteResult = await collection.bulkWrite(bulkWriteOperations, bulkWriteOptions);
            const { ok, matchedCount, insertedCount, upsertedCount, modifiedCount, deletedCount } = bulkWriteResult;
            logger.logDebug(`[${ok ? "OK" : "NG"}]  #-${matchedCount}  I-${insertedCount}  U-${upsertedCount}  M-${modifiedCount}  D-${deletedCount}  E-${bulkWriteResult.getWriteErrorCount()}`, {
                title: `${this.className}.bulkWrite - ${info}`,
                subject: collection.namespace,
            });
        } catch (error: unknown) {
            const { dbName, collectionName } = collection;
            this.handleError(error, `${dbName}.${collectionName}.bulkWrite - ${info}`);
        }
    }

    protected handleError(error: unknown, component: string): void {
        logger.logError(`${this.className}.${component}`, error);
    }

    subscribe(emitter: SummaryRoundInitiator, event: keyof SummaryRoundInitiatorEvents): boolean {
        if (this.emitters.has(emitter)) {
            logger.logWarning(`${this.className}.subscribe`, "Already subscribed");
            return false;
        }

        this.emitters.add(emitter);
        emitter.addListener(event, this.execute);
        return true;
    }

    unsubscribe(emitter: SummaryRoundInitiator, event: keyof SummaryRoundInitiatorEvents): boolean {
        if (!this.emitters.has(emitter)) {
            logger.logWarning(`${this.className}.unsubscribe`, "Currently unsubscribed");
            return false;
        }

        emitter.addListener(event, this.execute);
        this.emitters.delete(emitter);
        return true;
    }
}
