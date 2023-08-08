import { ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { SummaryGameExecutor } from "../modules/summary-game-executor";
import { SummaryRoundInitiator } from "../modules/summary-round-initiator";
import { RoundSummaryConfig } from "../types/summary-config";

const roundPipelineFactory = (config: RoundSummaryConfig): Document[] => {
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
        { $set: { "__archive.inserted": true } },
    ];
};

export class GameRoundSummarizer extends SummaryGameExecutor<RoundSummaryConfig> {
    constructor(mongoClient: MongoClient, roundSummariesNamespace: ChangeStreamNameSpace) {
        super(mongoClient, roundSummariesNamespace, roundPipelineFactory);
    }

    subscribe(emitter: SummaryRoundInitiator) {
        return super.subscribe(emitter, "ROUND");
    }
    unsubscribe(emitter: SummaryRoundInitiator) {
        return super.unsubscribe(emitter, "ROUND");
    }
}
