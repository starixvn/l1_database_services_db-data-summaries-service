import { AggregateOptions, ChangeStreamNameSpace, Collection, Document } from "mongodb";
import { logger } from "../loggers";
import { TimePipelineFactory } from "../types/pipeline-factory";
import { SummaryTimeInitiator, SummaryTimeInitiatorEvents } from "./summary-time-initiator";

export class SummaryTimeExecutor {
    private readonly emitters: Set<SummaryTimeInitiator> = new Set();

    constructor(
        private readonly roundSummariesCollection: Collection,
        private readonly targetNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: TimePipelineFactory
    ) {
        this.selfBound();

        this.roundSummariesCollection = roundSummariesCollection;
        this.targetNamespace = targetNamespace;
        this.pipelineFactory = pipelineFactory;
    }

    get className(): string {
        return this.constructor.name;
    }

    protected selfBound() {
        this.execute = this.execute.bind(this);
    }

    protected getPipeline(sourceCollectionName: string) {
        return this.pipelineFactory(sourceCollectionName);
    }
    protected async execute() {
        const aggregateOptions: AggregateOptions = {
            retryWrites: true,
            allowDiskUse: true,
        };

        const pipeline = this.getPipeline(this.roundSummariesCollection.collectionName);
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
            await this.roundSummariesCollection.aggregate(pipeline, aggregateOptions).tryNext();
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
