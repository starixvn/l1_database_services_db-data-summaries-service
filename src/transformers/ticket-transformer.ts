import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { DO_FLAG } from "../consts/summary-flags.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import type { BetSummaryConfig } from "../types/summary-config.js";
import { BaseTransformer } from "./base-transformer.js";

const pipelineFactory = (summaryConfig: BetSummaryConfig) => {
    const { gameConfigs, coll, filter, aliases, calc } = summaryConfig;
    const { gameId } = gameConfigs;
    const { round } = coll;
    const { foreign, playerId, settled, time } = aliases;
    const { tickets, stake, payout, refund, roundId } = calc;

    const roundLookup: Document[] = [];
    if (typeof roundId === "string" && roundId[0] === "$") {
        const foreignField = roundId.slice(1);

        roundLookup.push(
            {
                $lookup: {
                    from: round.coll,
                    localField: "_id.roundId",
                    foreignField,
                    pipeline: [{ $project: { _id: 0, time: `$${time}` } }],
                    as: "round",
                },
            },
            { $unwind: "$round", preserveNullAndEmptyArrays: true },
            { $set: { roundTime: "$round.time", round: "$$REMOVE" } }
        );
    }

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
                roundTime: { $max: "$time" },
                siteId: { $max: "$siteId" },
                currency: { $max: "$currency" },
                tickets: { $sum: tickets },
                stake: { $sum: stake },
                payout: { $sum: payout },
                refund: { $sum: refund },
            },
        },
        ...roundLookup,
        {
            $project: {
                _id: 0,
                time: "$time",
                roundTime: "$roundTime",
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
