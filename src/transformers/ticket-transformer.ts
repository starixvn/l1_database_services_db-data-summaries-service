import { ChangeStreamNameSpace, MongoClient } from "mongodb";
import { DO_FLAG } from "../consts/archiveFlags";
import { SummaryRoundInitiator } from "../modules/summary-round-initiator";
import { BetSummaryConfig } from "../types/summary-config";
import { BaseTransformer } from "./base-transformer";

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
                siteId: { $cond: [{ $eq: ["$operatorId", { $literal: "SabaPlay" }] }, "$siteId", "$$REMOVE"] },
                roundId: "$_id.roundId",
                tickets: "$tickets",
                stake: "$stake",
                payout: "$payout",
                refund: "$refund",
                winloss: { $subtract: ["$payout", "$stake"] },
                playerId: "$_id.playerId",
            },
        },
    ];
};

export class TicketTransformer extends BaseTransformer<BetSummaryConfig> {
    constructor(mongoClient: MongoClient, ticketSummariesNamespace: ChangeStreamNameSpace) {
        super(mongoClient, ticketSummariesNamespace, pipelineFactory);
    }

    subscribe(producer: SummaryRoundInitiator): boolean {
        return super.subscribe(producer, "bet", this.execute);
    }
    unsubscribe(producer: SummaryRoundInitiator): boolean {
        return super.unsubscribe(producer, "bet", this.execute);
    }
}
