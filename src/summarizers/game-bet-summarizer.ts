import { ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { SummaryGameExecutor } from "../modules/summary-game-executor";
import { SummaryRoundInitiator } from "../modules/summary-round-initiator";
import { BetSummaryConfig } from "../types/summary-config";

const roundPipelineFactory = (config: BetSummaryConfig): Document[] => {
    const {
        gameConfigs: { gameId },
        coll: { bet: betCollectionName },
        filter,
        aliases: { local, foreign, playerId, settled, time },
        calc: { payout, refund, stake },
    } = config;

    return [
        { $match: { $and: [{ $or: [{ "__archive.summarized": false }, { "__archive.summarized": null }] }, filter] } },
        { $project: { _id: 0, id: `$${local}`, time: `$${time}` } },
        { $lookup: { from: betCollectionName, localField: "id", foreignField: foreign, as: "bets" } },
        {
            $set: {
                bets: {
                    $filter: {
                        input: "$bets",
                        as: "b",
                        cond: { $and: [{ $gte: [`$$b.${playerId}`, 0] }, { $gt: [{ $toInt: `$$b.${settled}` }, 0] }] },
                    },
                },
            },
        },
        { $unwind: { path: "$bets", preserveNullAndEmptyArrays: true } },
        { $set: { "bets.roundId": "$id", "bets.time": "$time", id: "$$REMOVE", time: "$$REMOVE" } },
        { $replaceWith: "$bets" },
        {
            $group: {
                _id: { roundId: "$roundId", time: "$time", currency: { $ifNull: ["$currency", ""] }, operatorId: { $ifNull: ["$operatorId", ""] } },
                tickets: { $sum: { $toInt: { $gte: ["$playerId", 0] } } },
                stake: { $sum: stake },
                payout: { $sum: payout },
                refund: { $sum: refund },
                players: { $addToSet: "$playerId" },
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
                roundId: "$_id.roundId",
                tickets: "$tickets",
                stake: "$stake",
                payout: "$payout",
                refund: "$refund",
                winloss: { $subtract: ["$payout", "$stake"] },
                players: "$players",
                "__archive.inserted": { $literal: true },
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
