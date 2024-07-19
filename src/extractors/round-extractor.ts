import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { AGGREGATE_OPTIONS } from "../consts/aggregation.js";
import { DO_FLAG, DONE_FLAG } from "../consts/summary-flags.js";
import { Subscriber } from "../modules/subscriber.js";
import type { TransformerEvents } from "../transformers/base-transformer.js";
import type { RoundTransformer } from "../transformers/round-transformer.js";
import type { TicketTransformer } from "../transformers/ticket-transformer.js";
import type { TicketSummary } from "../types/summary-schema.js";

export class RoundExtractor extends Subscriber<keyof TransformerEvents, TransformerEvents, RoundTransformer | TicketTransformer> {
    private readonly flags: Map<string, Date> = new Map();

    constructor(
        private readonly mongo: MongoClient,
        private readonly ticketSummariesNamespace: ChangeStreamNameSpace,
        private readonly roundSummariesNamespace: ChangeStreamNameSpace,
        logger: BaseLogger
    ) {
        super(logger);
        this.selfBound();
    }

    get ticketSummariesCollection() {
        const { db, coll } = this.ticketSummariesNamespace;
        return this.mongo.db(db).collection<TicketSummary>(coll);
    }

    private selfBound() {
        this.execute = this.execute.bind(this);
    }

    private async execute(gameId: number) {
        const flag = `#${gameId}`;
        const flagValue = this.flags.get(flag);
        if (flagValue) {
            this.logger.logInfo({ title: this.className, message: `${flag} is running since ${flagValue.toISOString()}` });
            return;
        }

        try {
            this.flags.set(flag, new Date());
            await this.extract(gameId);
        } catch (error) {
            this.logger.logError({ title: this.className, message: error }, { extra: { flag, flagValue } });
        } finally {
            this.flags.delete(flag);
        }
    }

    private async extract(gameId: number) {
        const pipeline = this.getPipeline(gameId);

        await this.setDoSummaryFlag(gameId);
        await this.ticketSummariesCollection.aggregate(pipeline, AGGREGATE_OPTIONS).tryNext();
        await this.removeDoSummaryFlag(gameId);
    }

    private getPipeline(gameId: number) {
        return [
            { $match: { $and: [{ [DO_FLAG]: true, gameId }] } },
            {
                $group: {
                    _id: {
                        gameId: "$gameId",
                        roundId: "$roundId",
                        currency: "$currency",
                        operatorId: "$operatorId",
                        siteId: "$siteId",
                    },
                },
            },
            {
                $lookup: {
                    from: this.ticketSummariesNamespace.coll,
                    localField: "_id.gameId",
                    foreignField: "gameId",
                    let: { roundId: "$_id.roundId", operatorId: "$_id.operatorId", siteId: "$_id.siteId", currency: "$_id.currency" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$roundId", "$$roundId"] },
                                        { $eq: ["$operatorId", "$$operatorId"] },
                                        { $eq: ["$siteId", "$$siteId"] },
                                        { $eq: ["$currency", "$$currency"] },
                                    ],
                                },
                            },
                        },
                        { $project: { _id: 0, time: 1, roundTime: 1, tickets: 1, stake: 1, payout: 1, winloss: 1, win: 1, loss: 1, refund: 1, playerId: 1 } },
                    ],
                    as: "silo",
                },
            },
            { $unwind: "$silo" },
            {
                $group: {
                    _id: "$_id",
                    time: { $min: { $ifNull: ["$silo.roundTime", "$silo.time"] } },
                    tickets: { $sum: "$silo.tickets" },
                    stake: { $sum: "$silo.stake" },
                    payout: { $sum: "$silo.payout" },
                    winloss: { $sum: "$silo.winloss" },
                    win: { $sum: "$silo.win" },
                    loss: { $sum: "$silo.loss" },
                    refund: { $sum: "$silo.refund" },
                    playerIds: { $addToSet: "$silo.playerId" },
                },
            },
            {
                $project: {
                    _id: 0,
                    time: "$time",
                    currency: { $ifNull: ["$_id.currency", { $literal: "" }] },
                    gameId: "$_id.gameId",
                    operatorId: { $ifNull: ["$_id.operatorId", { $literal: "" }] },
                    siteId: { $ifNull: ["$_id.siteId", { $literal: "" }] },
                    roundId: "$_id.roundId",
                    tickets: "$tickets",
                    stake: { $round: ["$stake", 4] },
                    payout: { $round: ["$payout", 4] },
                    winloss: { $round: ["$winloss", 4] },
                    win: { $round: ["$win", 4] },
                    loss: { $round: ["$loss", 4] },
                    refund: { $round: ["$refund", 4] },
                    players: { $size: "$playerIds" },
                    playerIds: "$playerIds",
                },
            },
            {
                $match: {
                    gameId: { $ne: null },
                    currency: { $ne: null },
                    operatorId: { $ne: null },
                    siteId: { $ne: null },
                    time: { $ne: null },
                    roundId: { $ne: null },
                },
            },
            {
                $merge: {
                    into: this.roundSummariesNamespace,
                    on: ["gameId", "currency", "operatorId", "siteId", "roundId"],
                    whenMatched: "replace",
                    whenNotMatched: "insert",
                },
            },
        ] as const satisfies Document[];
    }

    private async setDoSummaryFlag(gameId: number) {
        const { matchedCount, upsertedCount, modifiedCount } = await this.ticketSummariesCollection.updateMany(
            { $or: [{ [DONE_FLAG]: false }, { [DONE_FLAG]: null }], gameId },
            { $set: { [DO_FLAG]: true } }
        );

        this.logger.logDebug({
            title: this.className,
            message: `#-${matchedCount}  I-${upsertedCount}  M-${modifiedCount}   (${gameId})`,
        });
    }

    private async removeDoSummaryFlag(gameId: number) {
        /** Only mark done for tickets older than 1 day */
        const timeWarmingFilter = { time: { $lt: new Date(Date.now() - 3_600_000) } };

        /**
         * Tickets in the same round will be marked done or excluded together
         * Mark done for tickets belong to rounds before this round.
         */
        const warmingRound = await this.ticketSummariesCollection
            .aggregate([{ $match: { [DO_FLAG]: true, gameId, ...timeWarmingFilter } }, { $project: { _id: 0, data: "$roundId" } }, { $sort: { data: -1 } }, { $limit: 1 }])
            .map((_) => _.data)
            .toArray();

        /** */
        const roundWarmingFilter = warmingRound.length ? { $expr: { $lt: ["$roundId", { $literal: warmingRound[0] }] } } : null;

        /** If cannot determine the round, use time filter */
        const doneFilter = roundWarmingFilter ?? timeWarmingFilter;

        /** Remove DO & mark DONE for non-warming tickets */
        const { matchedCount: matchedUpdated, modifiedCount: modifiedUpdated } = await this.ticketSummariesCollection.updateMany(
            { [DO_FLAG]: true, gameId, ...doneFilter },
            { $set: { [DONE_FLAG]: true } }
        );

        /** Only remove DO for warming tickets */
        const { matchedCount: matchedRemoved, modifiedCount: modifiedRemoved } = await this.ticketSummariesCollection.updateMany(
            { [DO_FLAG]: true, gameId },
            { $unset: { [DO_FLAG]: 1 } }
        );

        this.logger.logDebug({
            title: this.className,
            message: `+++  #-${matchedUpdated}  M-${modifiedUpdated}  +++    ---  #-${matchedRemoved}  M-${modifiedRemoved}  ---    (${gameId})`,
        });
    }

    subscribe<T extends RoundTransformer | TicketTransformer>(publisher: T) {
        return super.subscribe(publisher, "TRANSFORMED", this.execute);
    }

    unsubscribe<T extends RoundTransformer | TicketTransformer>(publisher: T) {
        return super.unsubscribe(publisher, "TRANSFORMED", this.execute);
    }
}
