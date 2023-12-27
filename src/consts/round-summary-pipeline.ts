import { Document } from "bson";
import { ChangeStreamNameSpace } from "mongodb";
import { SummaryConfig } from "../types/summary-config";
import { DO_FLAG } from "./summaryFlags";

export const roundSummaryPipelineFactory = (summaryConfig: SummaryConfig, ticketSummariesNamespace: ChangeStreamNameSpace, roundSummariesNamespace: ChangeStreamNameSpace) => {
    const {
        gameConfigs: { gameId },
        coll: { round },
        aliases: { time },
    } = summaryConfig;

    const pipeline: Document[] = [
        { $match: { $and: [{ [DO_FLAG]: true, gameId }] } },
        {
            $group: {
                _id: {
                    gameId: "$gameId",
                    roundId: "$roundId",
                    currency: { $ifNull: ["$currency", ""] },
                    operatorId: { $ifNull: ["$operatorId", ""] },
                    siteId: { $ifNull: ["$siteId", ""] },
                },
                tickets: { $sum: "$tickets" },
                stake: { $sum: "$stake" },
                payout: { $sum: "$payout" },
                winloss: { $sum: "$winloss" },
                refund: { $sum: "$refund" },
                playerIds: { $addToSet: "$playerId" },
            },
        },
        {
            $lookup: {
                from: round.coll,
                localField: "roundId",
                foreignField: "id",
                as: "round",
                pipeline: [{ $project: { _id: 0, time } }],
            },
        },
        { $unwind: { path: "$round", preserveNullAndEmptyArrays: false } },
        { $set: { time: { $ifNull: ["$round.time", "$time"] }, round: "$$REMOVE" } },
        {
            $project: {
                _id: 0,
                time: "$_id.time",
                currency: "$_id.currency",
                gameId: "$_id.gameId",
                operatorId: "$_id.operatorId",
                partnerId: "$_id.operatorId",
                roundId: "$_id.roundId",
                tickets: "$tickets",
                stake: "$stake",
                payout: "$payout",
                refund: "$refund",
                winloss: "$winloss",
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
                into: roundSummariesNamespace,
                on: ["gameId", "currency", "operatorId", "siteId", "time", "roundId"],
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        },
    ];

    return pipeline;
};
