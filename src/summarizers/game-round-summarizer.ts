import { MongoClient } from "mongodb";
import { GameSummarizer } from "../modules/game-summarizer";
import { GameSummaryInitializer, INIT_EVENT_NAMES } from "../modules/game-summary-initializer";
import { FromRoundSummaryConfig } from "../types/summary-config";

const roundPipelineFactory = (config: FromRoundSummaryConfig) => {
    const {
        gameConfigs: { gameId },
        aliases: { local, playerId, settled, time },
        calc: { payout, refund, stake },
    } = config;

    return [
        {
            $match: {
                "__archive.summarized": { $ne: true },
                [playerId]: { $gte: 0 },
                [settled]: true,
            },
        },
        {
            $project: {
                _id: 0,
                time: `$${time}`,
                currency: 1,
                gameId: { $literal: gameId },
                operatorId: 1,
                partnerId: "$operatorId",
                roundId: `$${local}`,
                tickets: { $literal: 1 },
                stake,
                payout,
                refund,
            },
        },
        {
            $set: {
                winloss: { $subtract: ["$payout", "$stake"] },
                minWinloss: { $subtract: ["$payout", "$stake"] },
                maxWinloss: { $subtract: ["$payout", "$stake"] },
            },
        },
        {
            $merge: {
                into: { db: "summary", coll: "round_summaries" },
                on: ["gameId", "currency", "operatorId", "time", "roundId"],
            },
        },
    ];
};

export class GameRoundSummarizer extends GameSummarizer<FromRoundSummaryConfig> {
    constructor(mongoClient: MongoClient) {
        super(mongoClient, roundPipelineFactory);
    }

    subscribe(emitter: GameSummaryInitializer) {
        return super.subscribe(emitter, INIT_EVENT_NAMES.ROUND);
    }
    unsubscribe(emitter: GameSummaryInitializer) {
        return super.unsubscribe(emitter, INIT_EVENT_NAMES.ROUND);
    }
}
