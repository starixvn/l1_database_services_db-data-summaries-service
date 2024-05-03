import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, MongoClient } from "@ldb/mongo";
import { DO_FLAG } from "../consts/summary-flags.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import type { BetSummaryConfig } from "../types/summary-config.js";
import { BaseTransformer } from "./base-transformer.js";

const pipelineFactory = (summaryConfig: BetSummaryConfig) => {
    const {
        gameConfigs: { gameId },
        filter,
        aliases: { foreign, playerId, settled },
        calc: { tickets, stake, payout, refund },
    } = summaryConfig;

    return [
        {
            $match: {
                $and: [{ [DO_FLAG]: true }, filter, { $expr: { $and: [{ $gt: [{ $toString: `$${playerId}` }, { $literal: "" }] }, { $gt: [{ $toInt: `$${settled}` }, 0] }] } }],
            },
        },
        {
            $group: {
                _id: { roundId: `$${foreign}`, operatorId: "$operatorId", playerId: { $toString: "$playerId" } },
                time: { $max: "$time" },
                siteId: { $max: "$siteId" },
                currency: { $max: "$currency" },
                tickets: { $sum: tickets },
                stake: { $sum: stake },
                payout: { $sum: payout },
                refund: { $sum: refund },
            },
        },
        {
            $project: {
                _id: 0,
                time: "$time",
                currency: "$currency",
                gameId: { $literal: gameId },
                operatorId: "$_id.operatorId",
                siteId: { $cond: [{ $eq: ["$_id.operatorId", { $literal: "SabaPlay" }] }, "$siteId", "$$REMOVE"] },
                roundId: "$_id.roundId",
                tickets: "$tickets",
                stake: { $round: ["$stake", 4] },
                payout: { $round: ["$payout", 4] },
                winloss: { $round: [{ $subtract: ["$payout", "$stake"] }, 4] },
                refund: { $round: ["$refund", 4] },
                playerId: "$_id.playerId",
            },
        },
    ];
};

export class TicketTransformer extends BaseTransformer<BetSummaryConfig> {
    constructor(mongo: MongoClient, ticketSummariesNamespace: ChangeStreamNameSpace, logger: BaseLogger) {
        super(mongo, ticketSummariesNamespace, pipelineFactory, logger);
    }

    subscribe(producer: SummaryInitiator): boolean {
        return super.subscribe(producer, "bet");
    }
    unsubscribe(producer: SummaryInitiator): boolean {
        return super.unsubscribe(producer, "bet");
    }
}
