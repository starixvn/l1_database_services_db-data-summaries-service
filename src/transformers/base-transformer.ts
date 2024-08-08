import type { BaseLogger } from "@ldb/base-logger";
import { Document, MongoClient, type ChangeStreamNameSpace, type Collection } from "@ldb/mongo";
import { AGGREGATE_OPTIONS } from "../consts/aggregation.js";
import { BATCH_LIMIT, BATCH_TERMINATE_THRESHOLD, DO_FLAG, DONE_FLAG, TIME_WARMING_PERIOD } from "../consts/summary-constants.js";
import { getSourceNamespace, getTicketRoundIdExpr } from "../helpers/summary-config.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import { version } from "../metadata.js";
import { Dispatcher } from "../modules/dispatcher.js";
import { SummaryConfig } from "../types/summary-config.js";

export const LOOKUP_ROUND = "__round" as const;
export const LOOKUP_USER = "__user" as const;

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
export type PipelineFactory<SC extends SummaryConfig> = (...args: [SC]) => Document[];

export class BaseTransformer<SC extends SummaryConfig> extends Dispatcher<TransformerEvents, Events<SC>, EventDescriptions<SC>, SummaryInitiator> {
    private readonly flags: Map<string, Date> = new Map();

    constructor(
        private readonly mongo: MongoClient,
        private readonly ticketSummariesNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: PipelineFactory<SC>,
        logger: BaseLogger
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
        const pipeline = this.prepareTransformPipeline(summaryConfig);

        let lastCount = 0;
        do {
            await this.setDoFlag(sourceCollection, summaryConfig);
            await sourceCollection.aggregate(pipeline, AGGREGATE_OPTIONS).toArray();
            lastCount = await this.setDoneFlag(sourceCollection);
        } while (lastCount >= BATCH_LIMIT * BATCH_TERMINATE_THRESHOLD);

        await this.setWarmingPeriodUndone(sourceCollection, summaryConfig);
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
        const versionStage = { $set: { __v: version } };
        const mergeStage = {
            $merge: {
                into: this.ticketSummariesNamespace,
                on: ["gameId", "roundId", "subRoundId", "operatorId", "playerId"],
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        } as const satisfies Document;

        pipeline.push(filterStage, versionStage, mergeStage);

        return pipeline;
    }

    private async setDoFlag(collection: Collection, summaryConfig: SC) {
        const settled = summaryConfig.aliases.settled;

        await collection
            .aggregate([
                {
                    $match: {
                        $or: [{ [DONE_FLAG]: false }, { [DONE_FLAG]: null }],
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
            { $set: { [DONE_FLAG]: true }, $unset: { [DO_FLAG]: 1 } }
        );

        this.logger.logDebug({ title: `${this.className}+${DONE_FLAG}`, message: `#=${matchedCount}  M=${modifiedCount}   (${collection.namespace})` });
        return modifiedCount;
    }

    private async setWarmingPeriodUndone(collection: Collection, summaryConfig: SC) {
        const warmingFilter = await this.buildWarmingFilter(summaryConfig);

        const { matchedCount, modifiedCount } = await collection.updateMany(
            warmingFilter, //
            { $set: { [DONE_FLAG]: false } }
        );
        this.logger.logDebug({ title: `${this.className}-${DONE_FLAG}`, message: `#=${matchedCount}  M=${modifiedCount}   (${collection.namespace})` });
    }
    private async buildWarmingFilter(summaryConfig: SC) {
        const { db, coll } = summaryConfig.coll.round;
        const roundCollection = this.mongo.db(db).collection(coll);

        const timeAlias = summaryConfig.aliases.time;
        const idExpr = summaryConfig.calc.roundId;

        const warmingFilter = { [timeAlias]: { $gte: new Date(Date.now() - TIME_WARMING_PERIOD) } };

        const warmingRoundId = await roundCollection
            .aggregate<{ id: number }>([
                { $match: warmingFilter }, //
                { $sort: { [timeAlias]: 1 } },
                { $project: { _id: 0, id: idExpr } },
                { $limit: 1 },
            ])
            .map(({ id }) => id)
            .toArray();

        const roundIdExpr = getTicketRoundIdExpr(summaryConfig);
        if (warmingRoundId.length) {
            return { $expr: { $gte: [roundIdExpr, warmingRoundId[0]] } };
        } else {
            return warmingFilter;
        }
    }

    private emitTransformed(summaryConfig: SC) {
        const { gameConfigs } = summaryConfig;
        const { gameId } = gameConfigs;
        this.emit<"TRANSFORMED">("TRANSFORMED", gameId);
    }

    subscribe<Event extends Events<SC>>(publisher: SummaryInitiator, event: Event) {
        return super.subscribe(publisher, event, this.execute);
    }

    unsubscribe<Event extends Events<SC>>(publisher: SummaryInitiator, event: Event) {
        return super.unsubscribe(publisher, event, this.execute);
    }
}
