import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import type { TimeInitiator } from "../initiators/time-initiator.js";
import { version } from "../metadata.js";
import { TimeExtractor } from "./time-extractor.js";

const dailyPipelineFactory = (sourceNamespace: ChangeStreamNameSpace, targetNamespace: ChangeStreamNameSpace): Document[] => [
    { $match: { "__archive.do_daily": true } },
    { $set: { roundTime: { $ifNull: ["$roundTime", "$time"] } } },
    {
        $group: {
            _id: {
                time: { $dateFromParts: { year: { $year: "$roundTime" }, month: { $month: "$roundTime" }, day: { $dayOfMonth: "$roundTime" } } },
                timeTo: { $dateFromParts: { year: { $year: "$roundTime" }, month: { $month: "$roundTime" }, day: { $add: [{ $dayOfMonth: "$roundTime" }, 1] } } },
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
                { $project: { _id: 0, tickets: 1, stake: 1, payout: 1, winloss: 1, win: 1, loss: 1, refund: 1, roundId: 1 } },
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

export class DailyStatement extends TimeExtractor<"DAILY"> {
    constructor(mongo: MongoClient, ticketSummariesNamespace: ChangeStreamNameSpace, dailyStatementsNamespace: ChangeStreamNameSpace, logger: BaseLogger) {
        super(mongo, ticketSummariesNamespace, dailyStatementsNamespace, dailyPipelineFactory, { type: "daily" }, logger);
    }

    subscribe(emitter: TimeInitiator) {
        return super.subscribe(emitter, "DAILY");
    }
    unsubscribe(emitter: TimeInitiator) {
        return super.unsubscribe(emitter, "DAILY");
    }
}
