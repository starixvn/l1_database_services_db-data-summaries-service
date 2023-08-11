import { AggregateOptions, ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { logger } from "../loggers";
import { TimePipelineFactory } from "../types/pipeline-factory";
import { getCollection } from "../utils/mongodb-utils";
import { SummaryTimeInitiator, SummaryTimeInitiatorEvents } from "./summary-time-initiator";

export class SummaryTimeExecutor {
    private readonly emitters: Set<SummaryTimeInitiator> = new Set();
    private summaryFlag = false;

    constructor(
        private readonly mongoClient: MongoClient,
        private readonly roundSummariesNamespace: ChangeStreamNameSpace,
        private readonly targetNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: TimePipelineFactory,
        private readonly configs: { type: string; hours: number }
    ) {
        this.selfBound();
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
            const { type } = this.configs;
            this.summaryFlag = false;
            logger.logDebug("", { title: this.className, subject: type });
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
            await this.markFlag();
            await this.getCollection(this.roundSummariesNamespace).aggregate(pipeline, aggregateOptions).tryNext();
            await this.updateFlag();
        } catch (error: unknown) {
            this.handleError(error, "executeMergeAggregate");
        }
    }

    protected async markFlag() {
        const { type } = this.configs;
        const flag = `__archive.${type}`;
        const doFlag = `__archive.do_${type}`;

        const roundSummariesCollection = this.getCollection(this.roundSummariesNamespace);
        const updateResult = await roundSummariesCollection.updateMany({ $or: [{ [flag]: false }, { [flag]: null }], "__archive.inserted": { $ne: true } }, { $set: { [doFlag]: true } });

        const { matchedCount, upsertedCount, modifiedCount } = updateResult;
        logger.logDebug(`#-${matchedCount}  U-${upsertedCount}  M-${modifiedCount}`, {
            title: `${this.className}.markFlag - ${type}`,
            subject: roundSummariesCollection.namespace,
        });
    }

    protected async updateFlag() {
        const { type } = this.configs;
        const flag = `__archive.${type}`;
        const doFlag = `__archive.do_${type}`;

        const roundSummariesCollection = this.getCollection(this.roundSummariesNamespace);
        const updateResult = await roundSummariesCollection.updateMany({ [doFlag]: true }, [{ $set: { [doFlag]: "$$REMOVE", [flag]: true } }]);
        const { matchedCount, upsertedCount, modifiedCount } = updateResult;
        logger.logDebug(`#-${matchedCount}  U-${upsertedCount}  M-${modifiedCount}`, {
            title: `${this.className}.updateFlag - ${type}`,
            subject: roundSummariesCollection.namespace,
        });
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
