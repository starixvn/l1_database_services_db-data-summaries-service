import { ChangeStreamNameSpace, Document, MongoClient } from "mongodb";
import { DO_FLAG } from "../consts/archiveFlags";
import { SummaryRoundInitiator } from "../modules/summary-round-initiator";
import { RoundSummaryConfig } from "../types/summary-config";
import { BaseTransformer } from "./base-transformer";

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
    constructor(mongoClient: MongoClient, ticketSummariesNamespace: ChangeStreamNameSpace) {
        super(mongoClient, ticketSummariesNamespace, pipelineFactory);
    }

    subscribe(producer: SummaryRoundInitiator): boolean {
        return super.subscribe(producer, "round", this.execute);
    }
    unsubscribe(producer: SummaryRoundInitiator): boolean {
        return super.unsubscribe(producer, "round", this.execute);
    }
}
