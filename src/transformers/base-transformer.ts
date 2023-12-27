import { MaybePromise } from "@ldb/types";
import { AggregateOptions, ChangeStreamNameSpace, Collection, Document, MongoClient, MongoServerError } from "mongodb";
import { roundSummaryPipelineFactory } from "../consts/round-summary-pipeline";
import { DONE_FLAG, DO_FLAG } from "../consts/summaryFlags";
import { Subsciber } from "../modules/subscriber";
import { SummaryConfig } from "../types/summary-config";
import { getCollection } from "../utils/mongodb-utils";

type Events<SC extends SummaryConfig> = SC["_brand"];
type EventDescriptions<SC extends SummaryConfig> = Record<Events<SC>, (config: SC) => MaybePromise<void>>;
export type PipelineFactory<SC extends SummaryConfig> = (...args: [SC]) => Document[];

export class BaseTransformer<SC extends SummaryConfig> extends Subsciber<Events<SC>, EventDescriptions<SC>> {
    private readonly flags: Map<string, boolean> = new Map();

    constructor(
        private readonly mongoClient: MongoClient,
        private readonly ticketSummariesNamespace: ChangeStreamNameSpace,
        private readonly roundSummariesNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: PipelineFactory<SC>
    ) {
        super();
        this.selfBound();
    }

    protected selfBound() {
        this.execute = this.execute.bind(this);
    }

    protected getPipeline(summaryConfig: SC) {
        return this.pipelineFactory(summaryConfig);
    }

    protected getSourceCollection(summaryConfig: SummaryConfig) {
        const { _brand, coll } = summaryConfig;
        const namespace = _brand === "bet" ? coll.bet : coll.round;

        return getCollection(this.mongoClient, namespace);
    }

    protected getFlag(summaryConfig: SC) {
        const { gameConfigs } = summaryConfig;
        const { gameId, name } = gameConfigs;

        return `#${gameId}.${name}`;
    }

    protected async execute(summaryConfig: SC) {
        const flag = this.getFlag(summaryConfig);

        if (this.flags.get(flag)) {
            this.logger.logWarning(this.className, `Summary process [${flag}] is running!`);
            return;
        }

        try {
            this.flags.set(flag, true);
            await this.runTransform(summaryConfig);
            await this.runSummary(summaryConfig);
        } catch (error: unknown) {
            this.handleError(error, flag);
        } finally {
            this.flags.delete(flag);
        }
    }

    protected async runTransform(summaryConfig: SC) {
        const aggregateOptions: AggregateOptions = { allowDiskUse: true };
        const {
            aliases: { time },
        } = summaryConfig;

        const sourceCollection = this.getSourceCollection(summaryConfig);
        const pipeline = this.prepareTransformPipeline(summaryConfig);

        await this.setDoSummaryFlag(sourceCollection);
        await sourceCollection.aggregate(pipeline, aggregateOptions).tryNext();
        await this.removeDoSummaryFlag(sourceCollection, time);
    }

    protected async runSummary(summaryConfig: SC) {
        const aggregateOptions: AggregateOptions = { allowDiskUse: true };
        const {
            aliases: { time },
        } = summaryConfig;

        const ticketCollection = getCollection(this.mongoClient, this.ticketSummariesNamespace);
        const pipeline: Document[] = roundSummaryPipelineFactory(summaryConfig, this.ticketSummariesNamespace, this.roundSummariesNamespace);

        await this.setDoSummaryFlag(ticketCollection);
        await ticketCollection.aggregate(pipeline, aggregateOptions).tryNext();
        await this.removeDoSummaryFlag(ticketCollection, time);
    }

    protected prepareTransformPipeline(summaryConfig: SC) {
        const pipeline = this.getPipeline(summaryConfig);

        const filterStage: Document = {
            $match: {
                gameId: { $ne: null },
                currency: { $ne: null },
                operatorId: { $ne: null },
                time: { $ne: null },
                roundId: { $ne: null },
                playerId: { $ne: null },
            },
        };
        const mergeStage: Document = {
            $merge: {
                into: this.ticketSummariesNamespace,
                on: ["gameId", "roundId", "operatorId", "playerId"],
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        };

        pipeline.push(filterStage);
        pipeline.push(mergeStage);

        return pipeline;
    }

    protected async setDoSummaryFlag(roundCollection: Collection) {
        const { matchedCount, upsertedCount, modifiedCount } = await roundCollection.updateMany(
            { $or: [{ [DONE_FLAG]: false }, { [DONE_FLAG]: null }] },
            { $set: { [DO_FLAG]: true } }
        );

        this.logger.logDebug("", {
            title: this.className,
            subject: `#=${matchedCount} U=${upsertedCount} M=${modifiedCount}   (${roundCollection.namespace})`,
        });
    }

    protected async removeDoSummaryFlag(roundCollection: Collection, timeField: string) {
        const warmingTime = new Date(Date.now() - 3_600_000);

        const { matchedCount: matchedUpdated, modifiedCount: modifiedUpdated } = await roundCollection.updateMany(
            { [DO_FLAG]: true, [timeField]: { $lt: warmingTime } },
            { $set: { [DONE_FLAG]: true } }
        );
        const { matchedCount: matchedRemoved, modifiedCount: modifiedRemoved } = await roundCollection.updateMany({ [DO_FLAG]: true }, { $unset: { [DO_FLAG]: 1 } });

        this.logger.logDebug("", {
            title: this.className,
            subject: `+++ #=${matchedUpdated} M=${modifiedUpdated} +++   --- #=${matchedRemoved} M=${modifiedRemoved} ---   (${roundCollection.namespace})`,
        });
    }

    protected handleError(error: unknown, component: string): void {
        if (error instanceof MongoServerError) {
            delete error.stack;
        }
        return super.handleError(error, component);
    }
}
