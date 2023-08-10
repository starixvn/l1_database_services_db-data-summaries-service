import { ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { SummaryTimeExecutor } from "../modules/summary-time-executor";
import { SummaryTimeInitiator } from "../modules/summary-time-initiator";

const hourlyPipelineFactory = (sourceCollectionName: string): Document[] => [
    { $match: { "__archive.do_hourly": true } },
    {
        $group: {
            _id: {
                time: { $dateFromParts: { year: { $year: "$time" }, month: { $month: "$time" }, day: { $dayOfMonth: "$time" }, hour: { $hour: "$time" } } },
                timeTo: { $dateFromParts: { year: { $year: "$time" }, month: { $month: "$time" }, day: { $dayOfMonth: "$time" }, hour: { $add: [{ $hour: "$time" }, 1] } } },
                currency: "$currency",
                gameId: "$gameId",
                operatorId: "$operatorId",
            },
        },
    },
    {
        $lookup: {
            from: sourceCollectionName,
            let: { time: "$_id.time", timeTo: "$_id.timeTo", currency: "$_id.currency", gameId: "$_id.gameId", operatorId: "$_id.operatorId" },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $gte: ["$time", "$$time"] },
                                { $lt: ["$time", "$$timeTo"] },
                                { $eq: ["$currency", "$$currency"] },
                                { $eq: ["$gameId", "$$gameId"] },
                                { $eq: ["$operatorId", "$$operatorId"] },
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
    { $set: { playerIds: { $reduce: { input: "$playerIds", initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } } } },
    {
        $project: {
            _id: 0,
            time: "$_id.time",
            currency: "$_id.currency",
            gameId: "$_id.gameId",
            operatorId: "$_id.operatorId",

            /** Backward compatibility */
            partnerId: "$_id.operatorId",

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

export class HourlySummarizer extends SummaryTimeExecutor {
    constructor(mongoClient: MongoClient, roundSummariesNamespace: ChangeStreamNameSpace, hourlySummariesNamespace: ChangeStreamNameSpace) {
        super(mongoClient, roundSummariesNamespace, hourlySummariesNamespace, hourlyPipelineFactory, { type: "hourly", hours: 1 });
    }

    subscribe(emitter: SummaryTimeInitiator) {
        return super.subscribe(emitter, "HOURLY");
    }
    unsubscribe(emitter: SummaryTimeInitiator) {
        return super.unsubscribe(emitter, "HOURLY");
    }
}
