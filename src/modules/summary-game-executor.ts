import { AggregateOptions, ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { logger } from "../loggers";
import { SummaryPipelineFactory } from "../types/pipeline-factory";
import { SummaryConfig } from "../types/summary-config";
import { getCollection } from "../utils/mongodb-utils";
import { SummaryRoundInitiator, SummaryRoundInitiatorEvents } from "./summary-round-initiator";

export class SummaryGameExecutor<TConfig extends SummaryConfig> {
    private readonly emitters: Set<SummaryRoundInitiator> = new Set();

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

    protected async execute(summaryConfig: TConfig) {
        const aggregateOptions: AggregateOptions = {
            retryWrites: true,
            allowDiskUse: true,
        };

        const {
            coll: { round },
        } = summaryConfig;

        const roundCollection = getCollection(this.mongoClient, round);
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
        } catch (error: unknown) {
            this.handleAggregateError(error, "executeMergeAggregate");
        }
    }

    protected handleAggregateError(error: unknown, component: string): void {
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
