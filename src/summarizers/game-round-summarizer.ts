import { ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { SummaryGameExecutor } from "../modules/summary-game-executor";
import { SummaryRoundInitiator } from "../modules/summary-round-initiator";
import { RoundSummaryConfig } from "../types/summary-config";

const roundPipelineFactory = (config: RoundSummaryConfig): Document[] => {
    const {
        gameConfigs: { gameId },
        aliases: { playerId, settled, time },
        filter,
        calc: { roundId, tickets, stake, payout, refund },
    } = config;

    return [
        { $match: { $and: [{ "__archive.do_summary": true, [playerId]: { $gte: 0 } }, filter, { $expr: { $gt: [{ $toInt: `$${settled}` }, 0] } }] } },
        {
            $project: {
                _id: 0,
                time: `$${time}`,
                currency: 1,
                gameId: { $literal: gameId },
                operatorId: 1,
                partnerId: "$operatorId",
                roundId,
                tickets,
                stake,
                payout,
                refund,
                players: { $literal: 1 },
                playerIds: [`$${playerId}`],
            },
        },
        { $set: { winloss: { $subtract: ["$payout", "$stake"] } } },
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
