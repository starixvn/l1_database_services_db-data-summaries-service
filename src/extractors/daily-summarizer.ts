import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import type { TimeInitiator } from "../initiators/time-initiator.js";
import { version } from "../metadata.js";
import { TimeExtractor } from "./time-extractor.js";

const dailyPipelineFactory = (sourceNamespace: ChangeStreamNameSpace, targetNamespace: ChangeStreamNameSpace): Document[] => [
    {
        $group: {
            _id: "$_ids.dailySummary",
        },
    },
    {
        $lookup: {
            from: sourceNamespace.coll,
            localField: "_id",
            foreignField: "_ids.dailySummary",
            as: "data",
        },
    },
    { $unwind: "$data" },
    {
        $group: {
            _id: "$_id",
            time: { $first: { $dateFromParts: { year: { $year: "$data.time" }, month: { $month: "$data.time" }, day: { $dayOfMonth: "$data.time" } } } },
            currency: { $first: "$data.currency" },
            gameId: { $first: "$data.gameId" },
            operatorId: { $first: "$data.operatorId" },
            siteId: { $first: "$data.siteId" },
            tickets: { $sum: "$data.tickets" },
            stake: { $sum: "$data.stake" },
            payout: { $sum: "$data.payout" },
            winloss: { $sum: "$data.winloss" },
            win: { $sum: "$data.win" },
            loss: { $sum: "$data.loss" },
            refund: { $sum: "$data.refund" },
            playerIds: { $addToSet: "$data.playerIds" },
            usdStake: { $sum: "$data.USD.stake" },
            usdPayout: { $sum: "$data.USD.payout" },
            usdWinloss: { $sum: "$data.USD.winloss" },
            usdWin: { $sum: "$data.USD.win" },
            usdLoss: { $sum: "$data.USD.loss" },
            usdRefund: { $sum: "$data.USD.refund" },
            vndStake: { $sum: "$data.VND.stake" },
            vndPayout: { $sum: "$data.VND.payout" },
            vndWinloss: { $sum: "$data.VND.winloss" },
            vndWin: { $sum: "$data.VND.win" },
            vndLoss: { $sum: "$data.VND.loss" },
            vndRefund: { $sum: "$data.VND.refund" },
        },
    },
    {
        $set: {
            playerIds: { $reduce: { input: "$playerIds", initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } },
        },
    },
    {
        $project: {
            _id: 1,
            time: 1,
            currency: 1,
            gameId: 1,
            operatorId: 1,
            partnerId: 1,
            siteId: 1,
            tickets: 1,
            stake: { $round: ["$stake", 4] },
            payout: { $round: ["$payout", 4] },
            winloss: { $round: ["$winloss", 4] },
            win: { $round: ["$win", 4] },
            loss: { $round: ["$loss", 4] },
            refund: { $round: ["$refund", 4] },
            players: { $size: "$playerIds" },
            playerIds: { $sortArray: { input: "$playerIds", sortBy: 1 } },
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
        $merge: {
            into: targetNamespace,
            on: "_id",
            whenMatched: "replace",
            whenNotMatched: "insert",
        },
    },
];

export class DailySummarizer extends TimeExtractor<"DAILY"> {
    constructor(mongo: MongoClient, roundSummariesNamespace: ChangeStreamNameSpace, dailySummariesNamespace: ChangeStreamNameSpace, logger: BaseLogger) {
        super(mongo, roundSummariesNamespace, dailySummariesNamespace, dailyPipelineFactory, { type: "daily" }, logger);
    }

    subscribe(emitter: TimeInitiator) {
        return super.subscribe(emitter, "DAILY");
    }
    unsubscribe(emitter: TimeInitiator) {
        return super.unsubscribe(emitter, "DAILY");
    }
}
