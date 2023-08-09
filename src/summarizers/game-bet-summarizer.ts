import { ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { SummaryGameExecutor } from "../modules/summary-game-executor";
import { SummaryRoundInitiator } from "../modules/summary-round-initiator";
import { BetSummaryConfig } from "../types/summary-config";

const roundPipelineFactory = (config: BetSummaryConfig): Document[] => {
    const {
        gameConfigs: { gameId },
        coll: { bet: betCollectionName },
        aliases: { local, foreign, playerId, settled, time },
        calc: { payout, refund, stake },
    } = config;

    return [
        { $match: { $or: [{ "__archive.summarized": false }, { "__archive.summarized": null }] } },
        { $project: { _id: 0, id: `$${local}`, time: `$${time}` } },
        {
            $lookup: {
                from: betCollectionName,
                let: { local: "$id" },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: [`$${foreign}`, "$$local"] }, { $gte: [`$${playerId}`, 0] }, { $gt: [{ $toInt: `$${settled}` }, 0] }] } } },
                    { $project: { _id: 1, currency: 1, operatorId: 1, playerId: 1, stake, payout, refund } },
                    { $set: { winloss: { $subtract: ["$payout", "$stake"] } } },
                ],
                as: "bets",
            },
        },
        { $set: { bet: "$bets" } },
        { $unwind: "$bet" },
        {
            $set: {
                bets: "$$REMOVE",
                runningWinloss: {
                    $sum: {
                        $map: {
                            input: { $filter: { input: "$bets", as: "b", cond: { $lte: ["$$b._id", "$bet._id"] } } },
                            as: "bb",
                            in: "$$bb.winloss",
                        },
                    },
                },
            },
        },
        {
            $group: {
                _id: { id: "$id", time: "$time", currency: "$bet.currency", operatorId: "$bet.operatorId" },
                tickets: { $sum: 1 },
                stake: { $sum: "$bet.stake" },
                payout: { $sum: "$bet.payout" },
                winloss: { $sum: "$bet.winloss" },
                minWinloss: { $min: "$runningWinloss" },
                maxWinloss: { $max: "$runningWinloss" },
                refund: { $sum: "$bet.refund" },
                players: { $addToSet: "$bet.playerId" },
            },
        },
        {
            $project: {
                _id: 0,
                time: "$_id.time",
                currency: "$_id.currency",
                gameId: { $literal: gameId },
                operatorId: "$_id.operatorId",
                partnerId: "$_id.operatorId",
                roundId: "$_id.id",
                tickets: "$tickets",
                stake: "$stake",
                payout: "$payout",
                refund: "$refund",
                winloss: "$winloss",
                minWinloss: "$minWinloss",
                maxWinloss: "$maxWinloss",
                players: "$players",
                "__archive.inserted": true,
            },
        },
    ];
};

export class GameBetSummarizer extends SummaryGameExecutor<BetSummaryConfig> {
    constructor(mongoClient: MongoClient, roundSummariesNamespace: ChangeStreamNameSpace) {
        super(mongoClient, roundSummariesNamespace, roundPipelineFactory);
    }

    subscribe(emitter: SummaryRoundInitiator) {
        return super.subscribe(emitter, "BET");
    }
    unsubscribe(emitter: SummaryRoundInitiator) {
        return super.unsubscribe(emitter, "BET");
    }
}
