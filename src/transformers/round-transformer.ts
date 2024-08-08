import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { DO_FLAG } from "../consts/summary-constants.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import type { RoundSummaryConfig } from "../types/summary-config.js";
import { BaseTransformer, LOOKUP_CURRENCY, LOOKUP_EXCHANGE, LOOKUP_USER } from "./base-transformer.js";

const pipelineFactory = (summaryConfig: RoundSummaryConfig) => {
    const { gameConfigs, aliases, filter, calc } = summaryConfig;
    const { gameId } = gameConfigs;
    const { playerId, settled, time, subRoundId } = aliases;
    const { roundId, tickets, stake, payout, refund } = calc;

    const pipeline: Document[] = [
        {
            $match: {
                $and: [
                    { [DO_FLAG]: true },
                    filter,
                    {
                        $expr: {
                            $and: [
                                { $gt: [{ $toString: `$${playerId}` }, { $literal: "" }] }, //
                                { $gt: [{ $toInt: `$${settled}` }, 0] },
                            ],
                        },
                    },
                ],
            },
        },

        {
            $lookup: {
                from: "user_silos",
                localField: "playerId",
                foreignField: "playerId",
                let: { operatorId: "$operatorId", playerId: "$playerId" },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ["$operatorId", "$$operatorId"] }, { $eq: ["$playerId", "$$playerId"] }] } } },
                    { $project: { _id: 0, currencyGroupId: 1, siteName: 1 } },
                    { $limit: 1 },
                ],
                as: LOOKUP_USER,
            },
        },
        { $unwind: { path: `$${LOOKUP_USER}`, preserveNullAndEmptyArrays: true } },
        { $set: { currencyGroupId: `$${LOOKUP_USER}.currencyGroupId`, siteName: `$${LOOKUP_USER}.siteName`, [LOOKUP_USER]: "$$REMOVE" } },

        {
            $lookup: {
                from: "currencies",
                localField: "currency",
                foreignField: "name",
                let: { operatorId: "$operatorId", currency: "$currency", groupId: "$currencyGroupId" },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ["$name", "$$currency"] }, { $eq: ["$partnerId", "$$operatorId"] }, { $eq: ["$groupId", "$$groupId"] }] } } },
                    { $project: { _id: 0, code: 1, multiplier: 1 } },
                    { $limit: 1 },
                ],
                as: LOOKUP_CURRENCY,
            },
        },
        { $unwind: { path: `$${LOOKUP_CURRENCY}`, preserveNullAndEmptyArrays: true } },
        {
            $set: {
                code: `$${LOOKUP_CURRENCY}.code`,
                __multiplier: `$${LOOKUP_CURRENCY}.multiplier`,
                [LOOKUP_CURRENCY]: "$$REMOVE",
            },
        },

        { $set: { __date: { $dateFromParts: { year: { $year: "$time" }, month: { $month: "$time" }, day: { $dayOfMonth: "$time" } } } } },
        {
            $lookup: {
                from: "exchange_silos",
                localField: "__date",
                foreignField: "time",
                let: { time: "$__date", code: "$code" },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ["$time", "$$time"] }, { $eq: ["$code", "$$code"] }] } } }, //
                    { $project: { _id: 0, USD: 1, VND: 1 } },
                    { $limit: 1 },
                ],
                as: LOOKUP_EXCHANGE,
            },
        },
        { $unwind: { path: `$${LOOKUP_EXCHANGE}`, preserveNullAndEmptyArrays: true } },
        { $set: { __USD: `$${LOOKUP_EXCHANGE}.USD`, __VND: `$${LOOKUP_EXCHANGE}.VND`, [LOOKUP_EXCHANGE]: "$$REMOVE" } },

        {
            $project: {
                _id: 1,
                time: `$${time}`,
                roundTime: `$${time}`,
                currency: 1,
                code: 1,
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
                currencyGroupId: 1,
                siteName: 1,
                __multiplier: 1,
                __USD: 1,
                __VND: 1,
            },
        },
        {
            $set: {
                stake: { $round: ["$stake", 4] },
                payout: { $round: ["$payout", 4] },
                winloss: { $round: [{ $subtract: ["$payout", "$stake"] }, 4] },
                refund: { $round: ["$refund", 4] },
                "USD.stake": { $round: [{ $multiply: ["$stake", "$__multiplier", "$__USD"] }, 4] },
                "USD.payout": { $round: [{ $multiply: ["$payout", "$__multiplier", "$__USD"] }, 4] },
                "USD.refund": { $round: [{ $multiply: ["$refund", "$__multiplier", "$__USD"] }, 4] },
                "VND.stake": { $round: [{ $multiply: ["$stake", "$__multiplier", "$__VND"] }, 4] },
                "VND.payout": { $round: [{ $multiply: ["$payout", "$__multiplier", "$__VND"] }, 4] },
                "VND.refund": { $round: [{ $multiply: ["$refund", "$__multiplier", "$__VND"] }, 4] },
            },
        },
        {
            $set: {
                win: { $max: ["$winloss", 0] },
                loss: { $min: ["$winloss", 0] },
                "USD.win": { $round: [{ $max: ["$USD.winloss", 0] }, 4] },
                "USD.loss": { $round: [{ $min: ["$USD.winloss", 0] }, 4] },
                "VND.win": { $round: [{ $max: ["$VND.winloss", 0] }, 4] },
                "VND.loss": { $round: [{ $min: ["$VND.winloss", 0] }, 4] },
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
