import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import type { TimeInitiator } from "../initiators/time-initiator.js";
import { version } from "../metadata.js";
import { TimeExtractor } from "./time-extractor.js";

const dailyPipelineFactory = (sourceNamespace: ChangeStreamNameSpace, targetNamespace: ChangeStreamNameSpace): Document[] => [
    { $match: { "__archive.do_daily": true } },
    {
        $group: {
            _id: {
                time: { $dateFromParts: { year: { $year: "$time" }, month: { $month: "$time" }, day: { $dayOfMonth: "$time" } } },
                timeTo: { $dateFromParts: { year: { $year: "$time" }, month: { $month: "$time" }, day: { $add: [{ $dayOfMonth: "$time" }, 1] } } },
                currency: "$currency",
                gameId: "$gameId",
                operatorId: "$operatorId",
                siteId: "$siteId",
            },
        },
    },
    {
        $lookup: {
            from: sourceNamespace.coll,
            localField: "_id.gameId",
            foreignField: "gameId",
            let: { time: "$_id.time", timeTo: "$_id.timeTo", currency: "$_id.currency", operatorId: "$_id.operatorId", siteId: "$_id.siteId" },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $gte: ["$time", "$$time"] },
                                { $lt: ["$time", "$$timeTo"] },
                                { $eq: ["$currency", "$$currency"] },
                                { $eq: ["$operatorId", "$$operatorId"] },
                                { $eq: ["$siteId", "$$siteId"] },
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
            tickets: { $sum: "$data.tickets" },
            stake: { $sum: "$data.stake" },
            payout: { $sum: "$data.payout" },
            winloss: { $sum: "$data.winloss" },
            win: { $sum: "$data.win" },
            loss: { $sum: "$data.loss" },
            refund: { $sum: "$data.refund" },
            playerIds: { $addToSet: "$data.playerIds" },
        },
    },
    {
        $set: {
            playerIds: { $reduce: { input: "$playerIds", initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } },
            siteId: { $ifNull: ["$_id.siteId", { $literal: "" }] },
        },
    },
    {
        $project: {
            _id: 0,
            time: "$_id.time",
            currency: "$_id.currency",
            gameId: "$_id.gameId",
            operatorId: "$_id.operatorId",
            partnerId: "$_id.operatorId",
            siteId: "$siteId",
            tickets: "$tickets",
            stake: { $round: ["$stake", 4] },
            payout: { $round: ["$payout", 4] },
            winloss: { $round: ["$winloss", 4] },
            win: { $round: ["$win", 4] },
            loss: { $round: ["$loss", 4] },
            refund: { $round: ["$refund", 4] },
            players: { $size: "$playerIds" },
            playerIds: "$playerIds",
            __v: version,
        },
    },
    {
        $merge: {
            into: targetNamespace,
            on: ["gameId", "currency", "operatorId", "siteId", "time"],
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
