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
                    currency: "$currency",
                    operatorId: "$operatorId",
                    siteId: "$siteId",
                },
            },
        },
        {
            $lookup: {
                from: ticketSummariesNamespace.coll,
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
                    { $project: { _id: 0, time: 1, tickets: 1, stake: 1, payout: 1, winloss: 1, refund: 1, playerId: 1 } },
                ],
                as: "silo",
            },
        },
        { $unwind: "$silo" },
        {
            $group: {
                _id: "$_id",
                time: { $min: "$silo.time" },
                tickets: { $sum: "$silo.tickets" },
                stake: { $sum: "$silo.stake" },
                payout: { $sum: "$silo.payout" },
                winloss: { $sum: "$silo.winloss" },
                refund: { $sum: "$silo.refund" },
                playerIds: { $addToSet: "$silo.playerId" },
            },
        },
        {
            $lookup: {
                from: round.coll,
                localField: "_id.roundId",
                foreignField: "id",
                as: "round",
                pipeline: [{ $project: { _id: 0, time: `$${time}` } }],
            },
        },
        { $unwind: { path: "$round", preserveNullAndEmptyArrays: false } },
        { $set: { time: { $ifNull: ["$round.time", "$time"] }, round: "$$REMOVE" } },
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
