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
        private readonly pipelineFactory: TimePipelineFactory
    ) {
        this.selfBound();

        this.mongoClient = mongoClient;
        this.roundSummariesNamespace = roundSummariesNamespace;
        this.targetNamespace = targetNamespace;
        this.pipelineFactory = pipelineFactory;
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
        const startTimer = Date.now();
        if (this.summaryFlag) {
            logger.logWarning(this.className, `Summary process is running!`);
            return;
        }

        try {
            this.summaryFlag = true;
            await this.runSummary();
        } finally {
            this.summaryFlag = false;
            logger.logDebug(`${Date.now() - startTimer} ms`, { title: this.className });
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
        } catch (error: unknown) {
            this.handleAggregateError(error, "executeMergeAggregate");
        }
    }

    protected handleAggregateError(error: unknown, component: string): void {
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
