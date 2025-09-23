import type { BaseLogger } from "@ldb/logger";
import type { ChangeStreamNameSpace, CollectionAggregationPipeline, MongoClient } from "@ldb/mongo";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import type { BetSummaryConfig } from "../types/summary-config.js";
import { BaseTransformer, LOOKUP_CURRENCY, LOOKUP_EXCHANGE, LOOKUP_ROUND, LOOKUP_SESSION, LOOKUP_USER, SESSION_TIMEOUT_MINUTES } from "./base-transformer.js";

const pipelineFactory = (summaryConfig: BetSummaryConfig) => {
    const { gameConfigs, coll, aliases, calc } = summaryConfig;
    const { gameId } = gameConfigs;
    const { round } = coll;
    const { foreign, playerId, time, subRoundId } = aliases;
    const { tickets, stake, payout, refund, roundId } = calc;

    const roundLookup: CollectionAggregationPipeline = [];
    if (typeof roundId === "string" && roundId[0] === "$") {
        const foreignField = roundId.slice(1);

        roundLookup.push(
            {
                $lookup: {
                    from: round.coll,
                    localField: "roundId",
                    foreignField,
                    pipeline: [{ $project: { _id: 1, time: `$${time}` } }, { $limit: 1 }],
                    as: LOOKUP_ROUND,
                },
            },
            { $unwind: { path: `$${LOOKUP_ROUND}`, preserveNullAndEmptyArrays: true } },
            { $set: { _roundId: `$${LOOKUP_ROUND}._id`, roundTime: { $ifNull: [`$${LOOKUP_ROUND}.time`, "$roundTime"] }, [LOOKUP_ROUND]: "$$REMOVE" } },
        );
    }

    return [
        {
            $project: {
                _id: 1,
                roundId: `$${foreign}`,
                subRoundId: `$${subRoundId}`,
                uid: 1,
                operatorId: 1,
                playerId: { $toString: `$${playerId}` },
                time: 1,
                roundTime: "$time",
                siteId: 1,
                currency: 1,
                tickets: { $sum: tickets },
                stake: { $sum: stake },
                payout: { $sum: payout },
                refund: { $sum: refund },
            },
        },

        ...roundLookup,

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

        { $set: { __date: { $dateFromParts: { year: { $year: "$roundTime" }, month: { $month: "$roundTime" }, day: { $dayOfMonth: "$roundTime" } } } } },
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
                    },
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
                _roundId: 1,
                time: 1,
                roundTime: 1,
                currency: 1,
                code: 1,
                gameId: { $literal: gameId },
                operatorId: 1,
                siteId: { $cond: [{ $eq: ["$operatorId", { $literal: "SabaPlay" }] }, "$siteId", ""] },
                roundId: 1,
                subRoundId: 1,
                tickets: 1,
                stake: { $toDecimal: { $round: ["$stake", 4] } },
                payout: { $toDecimal: { $round: ["$payout", 4] } },
                winloss: { $toDecimal: { $round: [{ $subtract: ["$payout", "$stake"] }, 4] } },
                refund: { $toDecimal: { $round: ["$refund", 4] } },
                playerId: 1,
                uid: { $toObjectId: "$uid" },
                currencyGroupId: 1,
                siteName: 1,
                isTest: 1,
                sessionId: 1,
                "USD.stake": { $toDecimal: { $round: [{ $multiply: ["$stake", "$__multiplier", "$__USD"] }, 4] } },
                "USD.payout": { $toDecimal: { $round: [{ $multiply: ["$payout", "$__multiplier", "$__USD"] }, 4] } },
                "USD.refund": { $toDecimal: { $round: [{ $multiply: ["$refund", "$__multiplier", "$__USD"] }, 4] } },
                "VND.stake": { $toDecimal: { $round: [{ $multiply: ["$stake", "$__multiplier", "$__VND"] }, 4] } },
                "VND.payout": { $toDecimal: { $round: [{ $multiply: ["$payout", "$__multiplier", "$__VND"] }, 4] } },
                "VND.refund": { $toDecimal: { $round: [{ $multiply: ["$refund", "$__multiplier", "$__VND"] }, 4] } },
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
                win: { $toDecimal: { $round: [{ $max: ["$winloss", 0] }, 4] } },
                loss: { $toDecimal: { $round: [{ $min: ["$winloss", 0] }, 4] } },
                "USD.win": { $toDecimal: { $round: [{ $max: ["$USD.winloss", 0] }, 4] } },
                "USD.loss": { $toDecimal: { $round: [{ $min: ["$USD.winloss", 0] }, 4] } },
                "VND.win": { $toDecimal: { $round: [{ $max: ["$VND.winloss", 0] }, 4] } },
                "VND.loss": { $toDecimal: { $round: [{ $min: ["$VND.winloss", 0] }, 4] } },
            },
        },
    ] satisfies CollectionAggregationPipeline;
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
