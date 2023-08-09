import { AggregateOptions, AnyBulkWriteOperation, BulkWriteOptions, ChangeStreamNameSpace, Collection, Document, MongoClient } from "mongodb";
import { logger } from "../loggers";
import { SummaryPipelineFactory } from "../types/pipeline-factory";
import { GameConfigInfo, SummaryConfig } from "../types/summary-config";
import { getCollection } from "../utils/mongodb-utils";
import { SummaryRoundInitiator, SummaryRoundInitiatorEvents } from "./summary-round-initiator";

const BULK_WRITE_THRESHOLD = 1_000;

export class SummaryGameExecutor<TConfig extends SummaryConfig> {
    private readonly emitters: Set<SummaryRoundInitiator> = new Set();
    private summaryFlag: Map<GameConfigInfo, boolean> = new Map();

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
        const startTimer = Date.now();
        const { gameConfigs } = summaryConfig;
        const { gameId, name } = gameConfigs;

        if (this.summaryFlag.get(gameConfigs)) {
            logger.logWarning(this.className, `Summary process #${gameId} - ${name} is running!`);
            return;
        }

        try {
            this.summaryFlag.set(gameConfigs, true);
            await this.runSummary(summaryConfig);
        } finally {
            this.summaryFlag.set(gameConfigs, false);
            logger.logDebug(`${Date.now() - startTimer} ms`, { title: this.className, subject: `#${gameId}.${name}` });
        }
    }

    protected async runSummary(summaryConfig: TConfig) {
        const aggregateOptions: AggregateOptions = {
            retryWrites: true,
            allowDiskUse: true,
        };

        const {
            coll: { round },
        } = summaryConfig;

        const roundCollection = this.getCollection(round);
        const pipeline = this.getPipeline(summaryConfig);

        const mergeStage: Document = {
            $merge: {
                into: this.roundSummariesNamespace,
                on: ["gameId", "currency", "operatorId", "time", "roundId"],
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        };
        pipeline.push(mergeStage);

        try {
            await roundCollection.aggregate(pipeline, aggregateOptions).tryNext();
            await this.updateFlag(summaryConfig);
        } catch (error: unknown) {
            this.handleError(error, "executeMergeAggregate");
        }
    }

    protected async updateFlag(summaryConfig: TConfig) {
        const {
            gameConfigs: { gameId },
            coll: { round },
            aliases: { local },
        } = summaryConfig;

        const roundSummariesCollection = this.getCollection(this.roundSummariesNamespace);
        const roundCollection = this.getCollection(round);

        let roundFlagUpdates: AnyBulkWriteOperation[] = [];
        let summaryFlagRemoves: AnyBulkWriteOperation[] = [];

        const insertedCursor = roundSummariesCollection.aggregate([{ $match: { "__archive.inserted": true, gameId } }, { $project: { _id: 1, roundId: 1 } }]);

        for await (const document of insertedCursor) {
            const { _id, roundId } = document;

            roundFlagUpdates.push({
                updateMany: {
                    filter: { [local]: roundId },
                    update: { $set: { "__archive.summarized": true } },
                },
            });

            summaryFlagRemoves.push({
                updateOne: {
                    filter: { _id },
                    update: { $unset: { "__archive.inserted": 1 } },
                },
            });

            if (roundFlagUpdates.length >= BULK_WRITE_THRESHOLD || summaryFlagRemoves.length >= BULK_WRITE_THRESHOLD) {
                await this.executeBulkWrite(roundCollection, roundFlagUpdates);
                await this.executeBulkWrite(roundSummariesCollection, summaryFlagRemoves);

                roundFlagUpdates = [];
                summaryFlagRemoves = [];
            }
        }

        if (roundFlagUpdates.length > 0) {
            await this.executeBulkWrite(roundCollection, roundFlagUpdates);
        }

        if (summaryFlagRemoves.length > 0) {
            await this.executeBulkWrite(roundSummariesCollection, summaryFlagRemoves);
        }
    }

    private async executeBulkWrite(collection: Collection, bulkWriteOperations: AnyBulkWriteOperation[]) {
        try {
            const bulkWriteOptions: BulkWriteOptions = { ordered: false };
            const bulkWriteResult = await collection.bulkWrite(bulkWriteOperations, bulkWriteOptions);
            const { ok, matchedCount, upsertedCount, modifiedCount } = bulkWriteResult;
            logger.logDebug({ ok, matchedCount, upsertedCount, modifiedCount }, { title: `${this.className}.bulkWrite`, subject: collection.namespace });
        } catch (error: unknown) {
            const { dbName, collectionName } = collection;
            this.handleError(error, `${dbName}.${collectionName}.bulkWrite`);
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
