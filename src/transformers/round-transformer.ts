import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { DO_FLAG } from "../consts/summary-flags.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import type { RoundSummaryConfig } from "../types/summary-config.js";
import { BaseTransformer } from "./base-transformer.js";

const pipelineFactory = (summaryConfig: RoundSummaryConfig) => {
    const { gameConfigs, aliases, filter, calc } = summaryConfig;
    const { gameId } = gameConfigs;
    const { playerId, settled, time, subRoundId } = aliases;
    const { roundId, tickets, stake, payout, refund } = calc;

    const pipeline: Document[] = [
        {
            $match: {
                $and: [{ [DO_FLAG]: true }, filter, { $expr: { $and: [{ $gt: [{ $toString: `$${playerId}` }, { $literal: "" }] }, { $gt: [{ $toInt: `$${settled}` }, 0] }] } }],
            },
        },
        {
            $project: {
                _id: 0,
                time: `$${time}`,
                roundTime: `$${time}`,
                currency: 1,
                gameId: { $literal: gameId },
                operatorId: 1,
                siteId: { $cond: [{ $eq: ["$operatorId", { $literal: "SabaPlay" }] }, "$siteId", "$$REMOVE"] },
                roundId,
                subRoundId: `$${subRoundId}`,
                tickets,
                stake,
                payout,
                refund,
                playerId: { $toString: "$playerId" },
            },
        },
        {
            $set: {
                stake: { $round: ["$stake", 4] },
                payout: { $round: ["$payout", 4] },
                winloss: { $round: [{ $subtract: ["$payout", "$stake"] }, 4] },
                refund: { $round: ["$refund", 4] },
            },
        },
        {
            $set: {
                win: { $max: ["$winloss", 0] },
                loss: { $min: ["$winloss", 0] },
            },
        },
    ];

    return pipeline;
};

export class RoundTransformer extends BaseTransformer<RoundSummaryConfig> {
    constructor(mongo: MongoClient, ticketSummariesNamespace: ChangeStreamNameSpace, logger: BaseLogger) {
        super(mongo, ticketSummariesNamespace, pipelineFactory, logger);
    }

    subscribe(producer: SummaryInitiator): boolean {
        return super.subscribe(producer, "round");
    }
    unsubscribe(producer: SummaryInitiator): boolean {
        return super.unsubscribe(producer, "round");
    }
}
