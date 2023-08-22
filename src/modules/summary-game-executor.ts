import { AggregateOptions, ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { logger } from "../loggers";
import { SummaryPipelineFactory } from "../types/pipeline-factory";
import { SummaryConfig } from "../types/summary-config";
import { getCollection } from "../utils/mongodb-utils";
import { SummaryRoundInitiator, SummaryRoundInitiatorEvents } from "./summary-round-initiator";

export class SummaryGameExecutor<TConfig extends SummaryConfig> {
    private readonly emitters: Set<SummaryRoundInitiator> = new Set();
    private readonly summaryFlag: Map<string, boolean> = new Map();

    constructor(
        private readonly mongoClient: MongoClient,
        private readonly roundSummariesNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: SummaryPipelineFactory<TConfig>
    ) {
        this.selfBound();
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

        if (summaryConfig.gameConfigs.gameId === 99) {
            logger.logDebug(await roundCollection.aggregate(pipeline, aggregateOptions).toArray());
        }

        pipeline.push(mergeStage);

        try {
            await this.markFlag(summaryConfig);
            await roundCollection.aggregate(pipeline, aggregateOptions).tryNext();
            await this.updateFlag(summaryConfig);
        } catch (error: unknown) {
            this.handleError(error, `executeMergeAggregate - ${name}`);
        }
    }

    protected async markFlag(summaryConfig: SummaryConfig) {
        const {
            coll: { round },
        } = summaryConfig;
        const flag = `__archive.summarized`;
        const doFlag = `__archive.do_summary`;

        const gameRoundCollection = this.getCollection(round);
        const updateResult = await gameRoundCollection.updateMany({ $or: [{ [flag]: false }, { [flag]: null }] }, { $set: { [doFlag]: true } });

        const { matchedCount, upsertedCount, modifiedCount } = updateResult;
        logger.logDebug(`#-${matchedCount}  U-${upsertedCount}  M-${modifiedCount}`, {
            title: `${this.className}.markFlag`,
            subject: gameRoundCollection.namespace,
        });
    }

    protected async updateFlag(summaryConfig: SummaryConfig) {
        const {
            coll: { round },
            aliases: { time },
        } = summaryConfig;
        const flag = `__archive.summarized`;
        const doFlag = `__archive.do_summary`;

        const warmingTime = new Date(Date.now() - 3_600_000);
        const gameRoundCollection = this.getCollection(round);
        const updateResult = await gameRoundCollection.updateMany({ [doFlag]: true, [time]: { $lt: warmingTime } }, { $set: { [flag]: true } });
        const removeResult = await gameRoundCollection.updateMany({ [doFlag]: true }, { $unset: { [doFlag]: 1 } });

        const { matchedCount: matchedUpdated, modifiedCount: modifiedUpdated } = updateResult;
        const { matchedCount: matchedRemoved, modifiedCount: modifiedRemoved } = removeResult;
        logger.logDebug(`+++ #-${matchedUpdated} M-${modifiedUpdated} +++    --- #-${matchedRemoved} M-${modifiedRemoved} ---`, {
            title: `${this.className}.updateFlag`,
            subject: gameRoundCollection.namespace,
        });
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
