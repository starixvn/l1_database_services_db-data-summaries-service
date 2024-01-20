import { ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { SummaryTimeExecutor } from "../modules/summary-time-executor";
import { SummaryTimeInitiator } from "../modules/summary-time-initiator";

const dailyPipelineFactory = (sourceCollectionName: string): Document[] => [
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
            from: sourceCollectionName,
            localfield: "_id.gameId",
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
            as: "round",
        },
    },
    { $unwind: "$round" },
    {
        $group: {
            _id: "$_id",
            tickets: { $sum: "$round.tickets" },
            stake: { $sum: "$round.stake" },
            payout: { $sum: "$round.payout" },
            winloss: { $sum: "$round.winloss" },
            refund: { $sum: "$round.refund" },
            playerIds: { $addToSet: "$round.playerIds" },
        },
    },
    {
        $set: {
            playerIds: { $reduce: { input: "$playerIds", initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } },
            siteId: { $ifNull: ["$siteId", { $literal: "" }] },
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
            siteId: "$_id.siteId",
            tickets: "$tickets",
            stake: "$stake",
            payout: "$payout",
            winloss: "$winloss",
            refund: "$refund",
            players: { $size: "$playerIds" },
            playerIds: "$playerIds",
        },
    },
];

export class DailySummarizer extends SummaryTimeExecutor {
    constructor(mongoClient: MongoClient, roundSummariesNamespace: ChangeStreamNameSpace, dailySummariesNamespace: ChangeStreamNameSpace) {
        super(mongoClient, roundSummariesNamespace, dailySummariesNamespace, dailyPipelineFactory, { type: "daily", hours: 24 });
    }

    subscribe(emitter: SummaryTimeInitiator) {
        return super.subscribe(emitter, "DAILY");
    }
    unsubscribe(emitter: SummaryTimeInitiator) {
        return super.unsubscribe(emitter, "DAILY");
    }
}
