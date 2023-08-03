import { stringify } from "@ldb/utils";
import { AggregateOptions, Collection, Document, MongoClient } from "mongodb";
import { logger } from "../loggers";
import { PipelineFactory, SummaryConfig } from "../types/summary-config";
import { GameSummaryInitializer, InitializerEventNames } from "./game-summary-initializer";
import { EJSON } from "bson";

export class GameSummarizer<TConfig extends SummaryConfig> {
    private readonly emitters: Set<GameSummaryInitializer> = new Set();

    constructor(private readonly mongoClient: MongoClient, private readonly pipelineFactory: PipelineFactory<TConfig>) {
        this.mongoClient = mongoClient;
        this.pipelineFactory = pipelineFactory;

        this.selfBound();
    }

    protected get className(): string {
        return this.constructor.name;
    }

    protected selfBound() {
        this.execute = this.execute.bind(this);
    }

    protected getRoundCollection(summaryConfig: TConfig): Collection {
        const {
            gameConfigs: { name },
            db,
            coll: { round },
        } = summaryConfig;
        const roundCollectionName = [name, round].filter(Boolean).join("");

        return this.mongoClient.db(db).collection(roundCollectionName);
    }

    protected getPipeline(summaryConfig: TConfig): Document[] {
        return this.pipelineFactory(summaryConfig);
    }

    async execute(summaryConfig: TConfig): Promise<void> {
        const aggregateOptions: AggregateOptions = {
            retryWrites: true,
            allowDiskUse: true,
            comment: "",
        };

        const collection = this.getRoundCollection(summaryConfig);
        const pipeline = this.getPipeline(summaryConfig);

        try {
            await collection.aggregate(pipeline, aggregateOptions).tryNext();
            logger.logInfo(`${this.className}.execute`, stringify(summaryConfig), true);
        } catch (error: unknown) {
            this.handleAggregateError(error, "executeMergeAggregate");
        }
    }

    protected handleAggregateError(error: unknown, component: string): void {
        logger.logError(`${this.className}.${component}`, error);
    }

    subscribe(emitter: GameSummaryInitializer, event: InitializerEventNames): boolean {
        if (this.emitters.has(emitter)) {
            logger.logWarning(`${this.className}.subscribe`, "Already subscribed");
            return false;
        }

        this.emitters.add(emitter);
        emitter.addListener(event, this.execute);
        return true;
    }

    unsubscribe(emitter: GameSummaryInitializer, event: InitializerEventNames): boolean {
        if (!this.emitters.has(emitter)) {
            logger.logWarning(`${this.className}.unsubscribe`, "Currently unsubscribed");
            return false;
        }

        emitter.addListener(event, this.execute);
        this.emitters.delete(emitter);
        return true;
    }
}
