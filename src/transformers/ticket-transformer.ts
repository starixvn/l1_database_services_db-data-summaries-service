import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { DO_FLAG } from "../consts/summary-constants.js";
import type { SummaryInitiator } from "../initiators/summary-initiator.js";
import type { BetSummaryConfig } from "../types/summary-config.js";
import { BaseTransformer, LOOKUP_CURRENCY, LOOKUP_EXCHANGE, LOOKUP_ROUND, LOOKUP_USER } from "./base-transformer.js";

const pipelineFactory = (summaryConfig: BetSummaryConfig) => {
    const { gameConfigs, coll, filter, aliases, calc } = summaryConfig;
    const { gameId } = gameConfigs;
    const { round } = coll;
    const { foreign, playerId, settled, time, subRoundId } = aliases;
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
                    pipeline: [{ $project: { _id: 0, time: `$${time}` } }, { $limit: 1 }],
                    as: LOOKUP_ROUND,
                },
            },
            { $unwind: { path: `$${LOOKUP_ROUND}`, preserveNullAndEmptyArrays: true } },
            { $set: { roundTime: { $ifNull: [`$${LOOKUP_ROUND}.time`, "$roundTime"] }, [LOOKUP_ROUND]: "$$REMOVE" } }
        );
    }

    return [
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
            $group: {
                _id: { roundId: `$${foreign}`, subRoundId: `$${subRoundId}`, operatorId: "$operatorId", playerId: { $toString: "$playerId" } },
                _siloId: { $min: "$_id" },
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
            $lookup: {
                from: "user_silos",
                localField: "_id.playerId",
                foreignField: "playerId",
                let: { operatorId: "$_id.operatorId", playerId: "$_id.playerId" },
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
                let: { operatorId: "$_id.operatorId", currency: "$currency", groupId: "$currencyGroupId" },
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
            $project: {
                _id: "$_siloId",
                time: "$time",
                roundTime: "$roundTime",
                currency: "$currency",
                code: "$code",
                gameId: { $literal: gameId },
                operatorId: "$_id.operatorId",
                siteId: { $cond: [{ $eq: ["$_id.operatorId", { $literal: "SabaPlay" }] }, "$siteId", "$$REMOVE"] },
                roundId: "$_id.roundId",
                subRoundId: "$_id.subRoundId",
                tickets: "$tickets",
                stake: { $round: ["$stake", 4] },
                payout: { $round: ["$payout", 4] },
                winloss: { $round: [{ $subtract: ["$payout", "$stake"] }, 4] },
                refund: { $round: ["$refund", 4] },
                playerId: "$_id.playerId",
                currencyGroupId: "$currencyGroupId",
                siteName: "$siteName",
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
                "USD.winloss": { $round: [{ $subtract: ["$USD.payout", "$USD.stake"] }, 4] },
                "VND.winloss": { $round: [{ $subtract: ["$VND.payout", "$VND.stake"] }, 4] },
            },
        },
        {
            $set: {
                win: { $round: [{ $max: ["$winloss", 0] }, 4] },
                loss: { $round: [{ $min: ["$winloss", 0] }, 4] },
                "USD.win": { $round: [{ $max: ["$USD.winloss", 0] }, 4] },
                "USD.loss": { $round: [{ $min: ["$USD.winloss", 0] }, 4] },
                "VND.win": { $round: [{ $max: ["$VND.winloss", 0] }, 4] },
                "VND.loss": { $round: [{ $min: ["$VND.winloss", 0] }, 4] },
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
