import type { BaseLogger } from "@ldb/base-logger";
import { Document, MongoClient, type ChangeStreamNameSpace, type Collection } from "@ldb/mongo";
import { AGGREGATE_OPTIONS } from "../consts/aggregation.js";
import { DO_FLAG, DONE_FLAG } from "../consts/summary-flags.js";
import { getRoundIdExpr, getSourceNamespace, getTicketRoundIdExpr } from "../helpers/summary-config.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import { Dispatcher } from "../modules/dispatcher.js";
import { SummaryConfig } from "../types/summary-config.js";

export const getFlag = (summaryConfig: SummaryConfig) => {
    const { gameConfigs } = summaryConfig;
    const { gameId, name } = gameConfigs;

    return `#${gameId}.${name}` as const;
};

export type TransformerEvents = {
    TRANSFORMED: (gameId: number, roundNamespace: ChangeStreamNameSpace, timeAlias: string) => void;
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

        await this.setDoSummaryFlag(sourceCollection);
        await sourceCollection.aggregate(pipeline, AGGREGATE_OPTIONS).tryNext();

        const doneFilter = await this.buildTransfromDoneFilter(summaryConfig);
        await this.removeDoSummaryFlag(sourceCollection, doneFilter);
    }

    private emitTransformed(summaryConfig: SC) {
        const { gameConfigs, coll, aliases } = summaryConfig;
        const { gameId } = gameConfigs;
        const { round } = coll;
        const { time } = aliases;
        this.emit<"TRANSFORMED">("TRANSFORMED", gameId, round, time);
    }

    private getSourceCollection(summaryConfig: SC) {
        const namespace = getSourceNamespace(summaryConfig);
        const { db, coll } = namespace;

        return this.mongo.db(db).collection(coll);
    }

    private getRoundCollection(summaryConfig: SC) {
        const { coll: configColl } = summaryConfig;
        const { round } = configColl;
        const { db, coll } = round;
        return this.mongo.db(db).collection(coll);
    }

    private prepareTransformPipeline(summaryConfig: SC) {
        const pipeline = this.pipelineFactory(summaryConfig);

        const filterStage = {
            $match: {
                gameId: { $ne: null },
                roundId: { $ne: null },
                operatorId: { $ne: null },
                playerId: { $ne: null },
            },
        } as const satisfies Document;
        const mergeStage = {
            $merge: {
                into: this.ticketSummariesNamespace,
                on: ["gameId", "roundId", "operatorId", "playerId"],
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        } as const satisfies Document;

        pipeline.push(filterStage);
        pipeline.push(mergeStage);

        return pipeline;
    }

    private async setDoSummaryFlag(collection: Collection, filter: Document = {}) {
        const { matchedCount, upsertedCount, modifiedCount } = await collection.updateMany(
            { $or: [{ [DONE_FLAG]: false }, { [DONE_FLAG]: null }], ...filter },
            { $set: { [DO_FLAG]: true } }
        );

        this.logger.logDebug({
            title: this.className,
            message: `#-${matchedCount}  I-${upsertedCount}  M-${modifiedCount}   (${collection.namespace})`,
        });
    }

    private async buildTransfromDoneFilter(summaryConfig: SC) {
        const { aliases } = summaryConfig;
        const { time, settled } = aliases;

        const warmingTimeFilter = { [time]: { $lt: new Date(Date.now() - 3_600_000) } };

        const roundCollection = this.getRoundCollection(summaryConfig);
        const id = getRoundIdExpr(summaryConfig);
        const warmingRound = await roundCollection
            .aggregate([{ $match: warmingTimeFilter }, { $project: { _id: 0, data: id } }, { $sort: { data: -1 } }, { $limit: 1 }])
            .map((_) => _.data)
            .toArray();

        const roundId = getTicketRoundIdExpr(summaryConfig);
        const warmingRoundFilter = warmingRound.length ? { $expr: { $lt: [roundId, { $literal: warmingRound[0] }] } } : null;

        const warmingFilter = warmingRoundFilter ?? warmingTimeFilter;
        return { ...warmingFilter, [settled]: true };
    }

    private async removeDoSummaryFlag(collection: Collection, doneFilter: Document) {
        const { matchedCount: matchedUpdated, modifiedCount: modifiedUpdated } = await collection.updateMany({ [DO_FLAG]: true, ...doneFilter }, { $set: { [DONE_FLAG]: true } });
        const { matchedCount: matchedRemoved, modifiedCount: modifiedRemoved } = await collection.updateMany({ [DO_FLAG]: true }, { $unset: { [DO_FLAG]: 1 } });

        this.logger.logDebug({
            title: this.className,
            message: `+++  #-${matchedUpdated}  M-${modifiedUpdated}  +++    ---  #-${matchedRemoved}  M-${modifiedRemoved}  ---    (${collection.namespace})`,
        });
    }

    subscribe<Event extends Events<SC>>(publisher: SummaryInitiator, event: Event) {
        return super.subscribe(publisher, event, this.execute);
    }

    unsubscribe<Event extends Events<SC>>(publisher: SummaryInitiator, event: Event) {
        return super.unsubscribe(publisher, event, this.execute);
    }
}
