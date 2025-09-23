import type { BaseLogger } from "@ldb/logger";
import { Document, MongoClient, type ChangeStreamNameSpace, type Collection, type CollectionAggregationPipeline, type MergeStage } from "@ldb/mongo";
import { Dispatcher, type StringKeyOf } from "@ldb/utils";
import { AGGREGATE_OPTIONS } from "../consts/aggregation.js";
import { BATCH_LIMIT, BATCH_TERMINATE_THRESHOLD, DO_FLAG, DONE_FLAG, TIME_WARMING_PERIOD } from "../consts/summary-constants.js";
import { getSourceNamespace } from "../helpers/summary-config.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import { version } from "../metadata.js";
import { SummaryConfig } from "../types/summary-config.js";

export const LOOKUP_ROUND = "__round" as const;
export const LOOKUP_USER = "__user" as const;
export const LOOKUP_CURRENCY = "__currency" as const;
export const LOOKUP_EXCHANGE = "__exchange" as const;
export const LOOKUP_SESSION = "__session" as const;
export const SESSION_TIMEOUT_MINUTES = 2 as const satisfies number;

export const getFlag = (summaryConfig: SummaryConfig) => {
    const { gameConfigs } = summaryConfig;
    const { gameId, name } = gameConfigs;

    return `#${gameId}.${name}` as const;
};

export type TransformerEvents = {
    TRANSFORMED: (gameId: number) => void;
};

type Events<SC extends SummaryConfig> = SC["_brand"];
type EventDescriptions<SC extends SummaryConfig> = Record<Events<SC>, (config: SC) => Promise<void>>;
export type PipelineFactory<SC extends SummaryConfig> = (...args: [SC]) => CollectionAggregationPipeline;

export class BaseTransformer<SC extends SummaryConfig> extends Dispatcher<TransformerEvents, EventDescriptions<SC>> {
    private readonly flags: Map<string, Date> = new Map();

    constructor(
        private readonly mongo: MongoClient,
        private readonly ticketSummariesNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: PipelineFactory<SC>,
        logger: BaseLogger,
    ) {
        super(logger);
        this.selfBound();
    }

    private selfBound() {
        this.execute = this.execute.bind(this);
    }

    private async execute(summaryConfig: SC) {
        const flag = getFlag(summaryConfig);

        const flagValue = this.flags.get(flag);
        if (flagValue) {
            this.logger.logInfo({ title: this.className, message: `${flag} is running since ${flagValue.toISOString()}` });
            return;
        }

        try {
            this.flags.set(flag, new Date());
            await this.transform(summaryConfig);
            this.emitTransformed(summaryConfig);
        } catch (error) {
            this.logger.logError({ title: this.className, message: error }, { extra: { flag, flagValue } });
        } finally {
            this.flags.delete(flag);
        }
    }

    private async transform(summaryConfig: SC) {
        const sourceCollection = this.getSourceCollection(summaryConfig);
        const { filter, aliases } = summaryConfig;
        const { playerId, settled, time } = aliases;

        const matchStage = {
            $match: {
                $and: [
                    { [DO_FLAG]: true }, //
                    filter,
                    { $expr: { $gt: [{ $toString: `$${playerId}` }, { $literal: "" }] } },
                    { $expr: { $gt: [{ $toInt: `$${settled}` }, 0] } },
                ],
            },
        };
        const pipeline = this.prepareTransformPipeline(summaryConfig);

        let lastCount = 0;
        do {
            await this.setDoFlag(sourceCollection, summaryConfig);
            await sourceCollection.aggregate([matchStage, ...pipeline], AGGREGATE_OPTIONS).toArray();
            lastCount = await this.setDoneFlag(sourceCollection);
        } while (lastCount >= BATCH_LIMIT * BATCH_TERMINATE_THRESHOLD);

        const matchWarmingStage = {
            $match: {
                $and: [
                    { [time]: { $gte: new Date(Date.now() - TIME_WARMING_PERIOD) } },
                    filter,
                    { $expr: { $gt: [{ $toString: `$${playerId}` }, { $literal: "" }] } },
                    { $expr: { $gt: [{ $toInt: `$${settled}` }, 0] } },
                ],
            },
        };
        await sourceCollection.aggregate([matchWarmingStage, ...pipeline], AGGREGATE_OPTIONS).toArray();
    }

    private getSourceCollection(summaryConfig: SC) {
        const namespace = getSourceNamespace(summaryConfig);
        const { db, coll } = namespace;

        return this.mongo.db(db).collection(coll);
    }

    private prepareTransformPipeline(summaryConfig: SC) {
        const pipeline = this.pipelineFactory(summaryConfig);

        const filterStage = {
            $match: {
                gameId: { $ne: null },
                roundId: { $ne: null },
                subRoundId: { $ne: null },
                operatorId: { $ne: null },
                playerId: { $ne: null },
            },
        } as const satisfies Document;
        const metaStages = [
            {
                $set: {
                    __v: version,
                    "_ids.roundSummary": {
                        $toHashedIndexKey: {
                            gameId: "$gameId",
                            currency: "$currency",
                            operatorId: "$operatorId",
                            siteId: "$siteId",
                            roundId: "$roundId",
                        },
                    },
                    "_ids.hourlyStatement": {
                        $toHashedIndexKey: {
                            gameId: "$gameId",
                            operatorId: "$operatorId",
                            playerId: "$playerId",
                            siteId: "$siteId",
                            time: {
                                $dateFromParts: {
                                    year: { $year: "$roundTime" },
                                    month: { $month: "$roundTime" },
                                    day: { $dayOfMonth: "$roundTime" },
                                    hour: { $hour: "$roundTime" },
                                },
                            },
                        },
                    },
                    "_ids.dailyStatement": {
                        $toHashedIndexKey: {
                            gameId: "$gameId",
                            operatorId: "$operatorId",
                            playerId: "$playerId",
                            siteId: "$siteId",
                            time: {
                                $dateFromParts: {
                                    year: { $year: "$roundTime" },
                                    month: { $month: "$roundTime" },
                                    day: { $dayOfMonth: "$roundTime" },
                                },
                            },
                        },
                    },
                },
            },
            {
                $set: {
                    "_ids.roundSummary": {
                        $toObjectId: {
                            $concat: [
                                { $cond: [{ $lt: ["$_ids.roundSummary", 0] }, "1", "0"] },
                                { $substrCP: ["000000000000000000000000", 0, { $subtract: [23, { $strLenCP: { $toString: { $abs: "$_ids.roundSummary" } } }] }] },
                                { $toString: { $abs: "$_ids.roundSummary" } },
                            ],
                        },
                    },
                    "_ids.hourlyStatement": {
                        $toObjectId: {
                            $concat: [
                                { $cond: [{ $lt: ["$_ids.hourlyStatement", 0] }, "1", "0"] },
                                { $substrCP: ["000000000000000000000000", 0, { $subtract: [23, { $strLenCP: { $toString: { $abs: "$_ids.hourlyStatement" } } }] }] },
                                { $toString: { $abs: "$_ids.hourlyStatement" } },
                            ],
                        },
                    },
                    "_ids.dailyStatement": {
                        $toObjectId: {
                            $concat: [
                                { $cond: [{ $lt: ["$_ids.dailyStatement", 0] }, "1", "0"] },
                                { $substrCP: ["000000000000000000000000", 0, { $subtract: [23, { $strLenCP: { $toString: { $abs: "$_ids.dailyStatement" } } }] }] },
                                { $toString: { $abs: "$_ids.dailyStatement" } },
                            ],
                        },
                    },
                },
            },
        ] satisfies CollectionAggregationPipeline;
        const mergeStage = {
            $merge: {
                into: this.ticketSummariesNamespace,
                on: "_id",
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        } as const satisfies MergeStage;

        return [...pipeline, filterStage, ...metaStages, mergeStage];
    }

    private async setDoFlag(collection: Collection, summaryConfig: SC) {
        const { time, settled } = summaryConfig.aliases;

        await collection
            .aggregate([
                {
                    $match: {
                        $or: [{ [DONE_FLAG]: false }, { [DONE_FLAG]: null }],
                        [time]: { $lt: new Date(Date.now() - TIME_WARMING_PERIOD) },
                        $expr: { $gt: [{ $toInt: `$${settled}` }, 0] },
                    },
                },
                { $limit: BATCH_LIMIT },
                { $project: { _id: 1, __archive: 1 } },
                { $set: { [DO_FLAG]: true } },
                { $merge: { into: collection.collectionName } },
            ])
            .toArray();
    }

    private async setDoneFlag(collection: Collection) {
        const { matchedCount, modifiedCount } = await collection.updateMany(
            { [DO_FLAG]: true }, //
            { $set: { [DONE_FLAG]: true }, $unset: { [DO_FLAG]: 1 } },
        );

        this.logger.logDebug({ title: `${this.className}+${DONE_FLAG}`, message: `#=${matchedCount}  M=${modifiedCount}   (${collection.namespace})` });
        return modifiedCount;
    }

    private emitTransformed(summaryConfig: SC) {
        const { gameConfigs } = summaryConfig;
        const { gameId } = gameConfigs;
        this.emit<"TRANSFORMED">("TRANSFORMED", gameId);
    }

    subscribe<Event extends StringKeyOf<EventDescriptions<SC>>>(publisher: SummaryInitiator, event: Event) {
        return super.subscribe(publisher, event, this.execute);
    }

    unsubscribe<Event extends StringKeyOf<EventDescriptions<SC>>>(publisher: SummaryInitiator, event: Event) {
        return super.unsubscribe(publisher, event, this.execute);
    }
}
