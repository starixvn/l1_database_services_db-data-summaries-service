import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { DO_FLAG } from "../consts/summary-flags.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import type { RoundSummaryConfig } from "../types/summary-config.js";
import { BaseTransformer } from "./base-transformer.js";

const pipelineFactory = (summaryConfig: RoundSummaryConfig) => {
    const {
        gameConfigs: { gameId },
        aliases: { playerId, settled, time },
        filter,
        calc: { roundId, tickets, stake, payout, refund },
    } = summaryConfig;

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
                currency: 1,
                gameId: { $literal: gameId },
                operatorId: 1,
                siteId: { $cond: [{ $eq: ["$operatorId", { $literal: "SabaPlay" }] }, "$siteId", "$$REMOVE"] },
                roundId,
                tickets,
                stake,
                payout,
                refund,
                playerId: { $toString: "$playerId" },
            },
        },
        { $set: { winloss: { $subtract: ["$payout", "$stake"] } } },
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
