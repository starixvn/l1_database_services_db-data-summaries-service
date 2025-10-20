import type { BaseLogger } from "@ldb/logger";
import type { ChangeStreamNameSpace, CollectionAggregationPipeline, MongoClient } from "@ldb/mongo";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import type { RoundSummaryConfig } from "../types/summary-config.js";
import { BaseTransformer, LOOKUP_CURRENCY, LOOKUP_EXCHANGE, LOOKUP_SESSION, LOOKUP_USER, SESSION_TIMEOUT_MINUTES, TICKET_WARMING_MINUTES } from "./base-transformer.js";

const pipelineFactory = (summaryConfig: RoundSummaryConfig) => {
    const { gameConfigs, aliases, calc } = summaryConfig;
    const { gameId } = gameConfigs;
    const { playerId, time, subRoundId } = aliases;
    const { roundId, tickets, stake, payout, refund } = calc;

    const pipeline: CollectionAggregationPipeline = [
        { $match: { [time]: { $lt: new Date(Date.now() - TICKET_WARMING_MINUTES * 60_000) } } },
        {
            $lookup: {
                from: "user_silos",
                localField: playerId,
                foreignField: "playerId",
                let: { operatorId: "$operatorId", playerId: `$${playerId}` },
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
                let: { operatorId: "$operatorId", currency: "$currency" },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ["$name", "$$currency"] }, { $eq: ["$partnerId", "$$operatorId"] }] } } },
                    { $project: { _id: 0, code: 1, multiplier: 1, isTest: 1 } },
                    { $limit: 1 },
                ],
                as: LOOKUP_CURRENCY,
            },
        },
        { $unwind: { path: `$${LOOKUP_CURRENCY}`, preserveNullAndEmptyArrays: true } },
        {
            $set: {
                code: `$${LOOKUP_CURRENCY}.code`,
                isTest: { $toInt: `$${LOOKUP_CURRENCY}.isTest` },
                __multiplier: `$${LOOKUP_CURRENCY}.multiplier`,
                [LOOKUP_CURRENCY]: "$$REMOVE",
            },
        },

        { $set: { __date: { $dateTrunc: { date: `$${time}`, unit: "day" } } } },
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
            $lookup: {
                from: "usersessions",
                localField: "uid",
                foreignField: "userId",
                let: { time: `$${time}` },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $gte: ["$$time", "$ssoTime"] }, // -
                                    { $lte: ["$$time", { $dateAdd: { startDate: "$recheckInTime", unit: "minute", amount: SESSION_TIMEOUT_MINUTES } }] },
                                ],
                            },
                        },
                    }, //
                    { $sort: { ssoTime: -1 } },
                    { $project: { _id: 0, sessionId: 1 } },
                    { $limit: 1 },
                ],
                as: LOOKUP_SESSION,
            },
        },
        { $unwind: { path: `$${LOOKUP_SESSION}`, preserveNullAndEmptyArrays: true } },
        { $set: { sessionId: `$${LOOKUP_SESSION}.sessionId`, [LOOKUP_SESSION]: "$$REMOVE" } },

        {
            $project: {
                _id: 1,
                _roundId: "$_id",
                time: `$${time}`,
                roundTime: `$${time}`,
                currency: 1,
                code: 1,
                gameId: { $literal: gameId },
                operatorId: 1,
                siteId: { $cond: [{ $eq: ["$operatorId", { $literal: "SabaPlay" }] }, "$siteId", ""] },
                roundId,
                subRoundId: `$${subRoundId}`,
                tickets,
                stake,
                payout,
                refund,
                playerId: { $toString: `$${playerId}` },
                uid: { $toObjectId: "$uid" },
                currencyGroupId: 1,
                siteName: 1,
                isTest: 1,
                sessionId: 1,
                __multiplier: 1,
                __USD: 1,
                __VND: 1,
            },
        },
        {
            $set: {
                stake: { $toDecimal: { $round: ["$stake", 4] } },
                payout: { $toDecimal: { $round: ["$payout", 4] } },
                winloss: { $toDecimal: { $round: [{ $subtract: ["$payout", "$stake"] }, 4] } },
                refund: { $toDecimal: { $round: ["$refund", 4] } },
                "USD.stake": { $toDecimal: { $round: [{ $multiply: ["$stake", "$__multiplier", "$__USD"] }, 4] } },
                "USD.payout": { $toDecimal: { $round: [{ $multiply: ["$payout", "$__multiplier", "$__USD"] }, 4] } },
                "USD.refund": { $toDecimal: { $round: [{ $multiply: ["$refund", "$__multiplier", "$__USD"] }, 4] } },
                "VND.stake": { $toDecimal: { $round: [{ $multiply: ["$stake", "$__multiplier", "$__VND"] }, 4] } },
                "VND.payout": { $toDecimal: { $round: [{ $multiply: ["$payout", "$__multiplier", "$__VND"] }, 4] } },
                "VND.refund": { $toDecimal: { $round: [{ $multiply: ["$refund", "$__multiplier", "$__VND"] }, 4] } },
                __multiplier: "$$REMOVE",
                __USD: "$$REMOVE",
                __VND: "$$REMOVE",
            },
        },
        {
            $set: {
                "USD.winloss": { $toDecimal: { $round: [{ $subtract: ["$USD.payout", "$USD.stake"] }, 4] } },
                "VND.winloss": { $toDecimal: { $round: [{ $subtract: ["$VND.payout", "$VND.stake"] }, 4] } },
            },
        },
        {
            $set: {
                win: { $toDecimal: { $max: ["$winloss", 0] } },
                loss: { $toDecimal: { $min: ["$winloss", 0] } },
                "USD.win": { $toDecimal: { $round: [{ $max: ["$USD.winloss", 0] }, 4] } },
                "USD.loss": { $toDecimal: { $round: [{ $min: ["$USD.winloss", 0] }, 4] } },
                "VND.win": { $toDecimal: { $round: [{ $max: ["$VND.winloss", 0] }, 4] } },
                "VND.loss": { $toDecimal: { $round: [{ $min: ["$VND.winloss", 0] }, 4] } },
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
