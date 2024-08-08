import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { AGGREGATE_OPTIONS } from "../consts/aggregation.js";
import { BATCH_LIMIT, BATCH_TERMINATE_THRESHOLD, DO_FLAG, DONE_FLAG } from "../consts/summary-constants.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import { version } from "../metadata.js";
import { Subscriber } from "../modules/subscriber.js";
import type { TransformerEvents } from "../transformers/base-transformer.js";
import type { RoundTransformer } from "../transformers/round-transformer.js";
import type { TicketTransformer } from "../transformers/ticket-transformer.js";
import type { TicketSummary } from "../types/summary-schema.js";

export class RoundExtractor extends Subscriber<keyof TransformerEvents, TransformerEvents, RoundTransformer | TicketTransformer | SummaryInitiator> {
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

        let lastCount = 0;
        do {
            await this.setDoFlag(gameId);
            await this.ticketSummariesCollection.aggregate(pipeline, AGGREGATE_OPTIONS).toArray();
            lastCount = await this.setDoneFlag(gameId);
        } while (lastCount >= BATCH_LIMIT * BATCH_TERMINATE_THRESHOLD);
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
                    usdStake: { $sum: "$silo.USD.stake" },
                    usdPayout: { $sum: "$silo.USD.payout" },
                    usdWinloss: { $sum: "$silo.USD.winloss" },
                    usdWin: { $sum: "$silo.USD.win" },
                    usdLoss: { $sum: "$silo.USD.loss" },
                    usdRefund: { $sum: "$silo.USD.refund" },
                    vndStake: { $sum: "$silo.VND.stake" },
                    vndPayout: { $sum: "$silo.VND.payout" },
                    vndWinloss: { $sum: "$silo.VND.winloss" },
                    vndWin: { $sum: "$silo.VND.win" },
                    vndLoss: { $sum: "$silo.VND.loss" },
                    vndRefund: { $sum: "$silo.VND.refund" },
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
                    "USD.stake": { $round: ["$usdStake", 4] },
                    "USD.payout": { $round: ["$usdPayout", 4] },
                    "USD.winloss": { $round: ["$usdWinloss", 4] },
                    "USD.win": { $round: ["$usdWin", 4] },
                    "USD.loss": { $round: ["$usdLoss", 4] },
                    "USD.refund": { $round: ["$usdRefund", 4] },
                    "VND.stake": { $round: ["$vndStake", 4] },
                    "VND.payout": { $round: ["$vndPayout", 4] },
                    "VND.winloss": { $round: ["$vndWinloss", 4] },
                    "VND.win": { $round: ["$vndWin", 4] },
                    "VND.loss": { $round: ["$vndLoss", 4] },
                    "VND.refund": { $round: ["$vndRefund", 4] },
                    __v: version,
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

    private async setDoFlag(gameId: number) {
        await this.ticketSummariesCollection
            .aggregate([
                { $match: { $or: [{ [DONE_FLAG]: false }, { [DONE_FLAG]: null }], gameId } },
                { $limit: BATCH_LIMIT },
                { $project: { _id: 1, __archive: 1 } },
                { $set: { [DO_FLAG]: true } },
                { $merge: { into: this.ticketSummariesCollection.collectionName } },
            ])
            .toArray();
    }

    private async setDoneFlag(gameId: number) {
        const { matchedCount, modifiedCount } = await this.ticketSummariesCollection.updateMany(
            { [DO_FLAG]: true, gameId }, //
            { $set: { [DONE_FLAG]: true }, $unset: { [DO_FLAG]: 1 } }
        );

        this.logger.logDebug({ title: `${this.className}+${DONE_FLAG}`, message: `#=${matchedCount}  M=${modifiedCount}   (${gameId})` });
        return modifiedCount;
    }

    subscribe<T extends RoundTransformer | TicketTransformer>(publisher: T) {
        return super.subscribe(publisher, "TRANSFORMED", this.execute);
    }

    unsubscribe<T extends RoundTransformer | TicketTransformer>(publisher: T) {
        return super.unsubscribe(publisher, "TRANSFORMED", this.execute);
    }
}
