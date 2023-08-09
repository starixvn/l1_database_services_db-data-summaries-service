import { AggregateOptions, AnyBulkWriteOperation, BulkWriteOptions, ChangeStreamNameSpace, Collection, Document, MongoClient } from "mongodb";
import { logger } from "../loggers";
import { TimePipelineFactory } from "../types/pipeline-factory";
import { getCollection } from "../utils/mongodb-utils";
import { SummaryTimeInitiator, SummaryTimeInitiatorEvents } from "./summary-time-initiator";

const BULK_WRITE_THRESHOLD = 1_000;

export class SummaryTimeExecutor {
    private readonly emitters: Set<SummaryTimeInitiator> = new Set();
    private summaryFlag = false;

    constructor(
        private readonly mongoClient: MongoClient,
        private readonly roundSummariesNamespace: ChangeStreamNameSpace,
        private readonly targetNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: TimePipelineFactory,
        private readonly type: string
    ) {
        this.selfBound();

        this.mongoClient = mongoClient;
        this.roundSummariesNamespace = roundSummariesNamespace;
        this.targetNamespace = targetNamespace;
        this.pipelineFactory = pipelineFactory;
        this.type = type;
    }

    get className(): string {
        return this.constructor.name;
    }

    protected selfBound() {
        this.execute = this.execute.bind(this);
    }

    protected getCollection(namespace: ChangeStreamNameSpace) {
        return getCollection(this.mongoClient, namespace);
    }

    protected getPipeline(sourceCollectionName: string) {
        return this.pipelineFactory(sourceCollectionName);
    }

    protected async execute() {
        if (this.summaryFlag) {
            logger.logWarning(this.className, `Summary process is running!`);
            return;
        }

        try {
            this.summaryFlag = true;
            await this.runSummary();
        } finally {
            this.summaryFlag = false;
            logger.logDebug("", { title: this.className, subject: this.type });
        }
    }

    protected async runSummary() {
        const aggregateOptions: AggregateOptions = { allowDiskUse: true };

        const pipeline = this.getPipeline(this.roundSummariesNamespace.coll);
        const mergeStage: Document = {
            $merge: {
                into: this.targetNamespace,
                on: ["gameId", "currency", "operatorId", "time"],
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        };
        pipeline.push(mergeStage);

        try {
            await this.getCollection(this.roundSummariesNamespace).aggregate(pipeline, aggregateOptions).tryNext();
            await this.updateFlag();
        } catch (error: unknown) {
            this.handleError(error, "executeMergeAggregate");
        }
    }

    protected async updateFlag() {
        const targetCollection = this.getCollection(this.targetNamespace);
        const roundSummariesCollection = this.getCollection(this.roundSummariesNamespace);

        let roundFlagUpdates: AnyBulkWriteOperation[] = [];
        let targetFlagRemoves: AnyBulkWriteOperation[] = [];

        const insertedCursor = targetCollection.find({ "__archive.inserted": true }, { projection: { _id: 1, gameId: 1, time: 1, currency: 1, operatorId: 1 } });

        for await (const document of insertedCursor) {
            const { _id, gameId, time, currency, operatorId } = document;
            const toTime = new Date(time.valueOf() + 24 * 3_600_000);

            if (isNaN(toTime.valueOf())) {
                continue;
            }

            roundFlagUpdates.push({ updateMany: { filter: { gameId, time: { $gte: time, $lt: toTime }, currency, operatorId }, update: { $set: { [`__archive.${this.type}`]: true } } } });
            targetFlagRemoves.push({ updateOne: { filter: { _id }, update: { $unset: { "__archive.inserted": 1 } } } });

            if (roundFlagUpdates.length >= BULK_WRITE_THRESHOLD || targetFlagRemoves.length >= BULK_WRITE_THRESHOLD) {
                await this.executeBulkWrite(roundSummariesCollection, roundFlagUpdates, this.type);
                await this.executeBulkWrite(targetCollection, targetFlagRemoves, this.type);

                roundFlagUpdates = [];
                targetFlagRemoves = [];
            }
        }

        if (roundFlagUpdates.length > 0) {
            await this.executeBulkWrite(roundSummariesCollection, roundFlagUpdates, this.type);
        }

        if (targetFlagRemoves.length > 0) {
            await this.executeBulkWrite(targetCollection, targetFlagRemoves, this.type);
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

    subscribe(emitter: SummaryTimeInitiator, event: keyof SummaryTimeInitiatorEvents): boolean {
        if (this.emitters.has(emitter)) {
            logger.logWarning(`${this.className}.subscribe`, "Already subscribed");
            return false;
        }

        this.emitters.add(emitter);
        emitter.addListener(event, this.execute);
        return true;
    }

    unsubscribe(emitter: SummaryTimeInitiator, event: keyof SummaryTimeInitiatorEvents): boolean {
        if (!this.emitters.has(emitter)) {
            logger.logWarning(`${this.className}.unsubscribe`, "Currently unsubscribed");
            return false;
        }

        emitter.addListener(event, this.execute);
        this.emitters.delete(emitter);
        return true;
    }
}
