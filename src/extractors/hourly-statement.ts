import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import type { TimeInitiator } from "../initiators/time-initiator.js";
import { version } from "../metadata.js";
import { TimeExtractor } from "./time-extractor.js";

const hourlyPipelineFactory = (sourceNamespace: ChangeStreamNameSpace, targetNamespace: ChangeStreamNameSpace): Document[] => [
    { $match: { "__archive.do_hourly": true } },
    { $set: { roundTime: { $ifNull: ["$roundTime", "$time"] } } },
    {
        $group: {
            _id: {
                time: { $dateFromParts: { year: { $year: "$roundTime" }, month: { $month: "$roundTime" }, day: { $dayOfMonth: "$roundTime" }, hour: { $hour: "$roundTime" } } },
                timeTo: {
                    $dateFromParts: {
                        year: { $year: "$roundTime" },
                        month: { $month: "$roundTime" },
                        day: { $dayOfMonth: "$roundTime" },
                        hour: { $add: [{ $hour: "$roundTime" }, 1] },
                    },
                },
                gameId: "$gameId",
                operatorId: "$operatorId",
                siteId: "$siteId",
                playerId: "$playerId",
            },
            currency: { $first: "$currency" },
        },
    },
    {
        $lookup: {
            from: sourceNamespace.coll,
            localField: "_id.gameId",
            foreignField: "gameId",
            let: { time: "$_id.time", timeTo: "$_id.timeTo", operatorId: "$_id.operatorId", siteId: "$_id.siteId", playerId: "$_id.playerId" },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $gte: [{ $ifNull: ["$roundTime", "$time"] }, "$$time"] },
                                { $lt: [{ $ifNull: ["$roundTime", "$time"] }, "$$timeTo"] },
                                { $eq: ["$operatorId", "$$operatorId"] },
                                { $eq: ["$siteId", "$$siteId"] },
                                { $eq: ["$playerId", "$$playerId"] },
                            ],
                        },
                    },
                },
            ],
            as: "data",
        },
    },
    { $unwind: "$data" },
    {
        $group: {
            _id: "$_id",
            currency: { $first: "$currency" },
            tickets: { $sum: "$data.tickets" },
            stake: { $sum: "$data.stake" },
            payout: { $sum: "$data.payout" },
            winloss: { $sum: "$data.winloss" },
            win: { $sum: "$data.win" },
            loss: { $sum: "$data.loss" },
            refund: { $sum: "$data.refund" },
            roundIds: { $addToSet: "$data.roundId" },
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
            roundIds: { $reduce: { input: ["$roundIds"], initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } },
            siteId: { $ifNull: ["$_id.siteId", { $literal: "" }] },
        },
    },
    {
        $project: {
            _id: 0,
            time: "$_id.time",
            currency: "$currency",
            gameId: "$_id.gameId",
            operatorId: "$_id.operatorId",
            siteId: "$siteId",
            playerId: "$_id.playerId",
            tickets: "$tickets",
            stake: { $round: ["$stake", 4] },
            payout: { $round: ["$payout", 4] },
            winloss: { $round: ["$winloss", 4] },
            win: { $round: ["$win", 4] },
            loss: { $round: ["$loss", 4] },
            refund: { $round: ["$refund", 4] },
            rounds: { $size: "$roundIds" },
            roundIds: "$roundIds",
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
            on: ["gameId", "operatorId", "playerId", "siteId", "time"],
            whenMatched: "replace",
            whenNotMatched: "insert",
        },
    },
];

export class HourlyStatement extends TimeExtractor<"HOURLY"> {
    constructor(mongo: MongoClient, ticketSummariesNamespace: ChangeStreamNameSpace, hourlyStatementsNamespace: ChangeStreamNameSpace, logger: BaseLogger) {
        super(mongo, ticketSummariesNamespace, hourlyStatementsNamespace, hourlyPipelineFactory, { type: "hourly" }, logger);
    }

    subscribe(emitter: TimeInitiator) {
        return super.subscribe(emitter, "HOURLY");
    }
    unsubscribe(emitter: TimeInitiator) {
        return super.unsubscribe(emitter, "HOURLY");
    }
}
