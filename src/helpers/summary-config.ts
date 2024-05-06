import { EJSON } from "@ldb/mongo";
import type {
    BetSummaryCollectionConfig,
    BetSummaryConfig,
    CalculationConfig,
    RoundSummaryCollectionConfig,
    RoundSummaryConfig,
    SchemaBetSummaryConfig,
    SchemaRoundSummaryConfig,
    SchemaSummaryConfig,
    SummaryConfig,
} from "../types/summary-config.js";

export const throwSummaryConfigError = (summaryConfig: SummaryConfig) => {
    const error = new TypeError("Invalid summary config schema");
    Object.assign(error, { summaryConfig });
    throw error;
};

export function isBetSummaryConfig(summaryConfig: SchemaSummaryConfig): summaryConfig is SchemaBetSummaryConfig;
export function isBetSummaryConfig(summaryConfig: SummaryConfig): summaryConfig is BetSummaryConfig;
export function isBetSummaryConfig(summaryConfig: SchemaSummaryConfig | SummaryConfig): summaryConfig is SchemaBetSummaryConfig | BetSummaryConfig {
    const { _brand, coll = {} } = summaryConfig;
    return _brand === "bet" || ("round" in coll && "bet" in coll);
}

export function isRoundSummaryConfig(summaryConfig: SchemaSummaryConfig): summaryConfig is SchemaRoundSummaryConfig;
export function isRoundSummaryConfig(summaryConfig: SummaryConfig): summaryConfig is RoundSummaryConfig;
export function isRoundSummaryConfig(summaryConfig: SchemaSummaryConfig | SummaryConfig): summaryConfig is SchemaRoundSummaryConfig | RoundSummaryConfig {
    const { _brand, coll = {} } = summaryConfig;
    return _brand === "round" || ("round" in coll && !("bet" in coll));
}

export function parseSummaryConfig(betSummaryConfig: SchemaBetSummaryConfig): BetSummaryConfig;
export function parseSummaryConfig(roundSummaryConfig: SchemaRoundSummaryConfig): RoundSummaryConfig;
export function parseSummaryConfig(summaryConfig: SchemaSummaryConfig): SummaryConfig;
export function parseSummaryConfig(summaryConfig: SchemaSummaryConfig): SummaryConfig {
    if (isBetSummaryConfig(summaryConfig)) {
        return parseBetSummaryConfig(summaryConfig);
    } else if (isRoundSummaryConfig(summaryConfig)) {
        return parseRoundSummaryConfig(summaryConfig);
    } else {
        return throwSummaryConfigError(summaryConfig);
    }
}

export const parseBetSummaryConfig = (betSummaryConfig: SchemaBetSummaryConfig): BetSummaryConfig => {
    const { gameConfigs, db, coll: rawColl, filter: filterRaw = "{}", calc: rawCalc, ...restConfig } = betSummaryConfig;
    const { round, bet } = rawColl;
    const { roundId = '"$roundId"', tickets = '{"$literal":1}', stake, payout, refund } = rawCalc;
    const { name } = gameConfigs;

    const roundCollectionName = name.concat(round);
    const betCollectionName = name.concat(bet);

    const coll: BetSummaryCollectionConfig = { round: { db, coll: roundCollectionName }, bet: { db, coll: betCollectionName } };
    const calc: CalculationConfig = {
        roundId: EJSON.parse(roundId),
        tickets: EJSON.parse(tickets),
        stake: EJSON.parse(stake),
        payout: EJSON.parse(payout),
        refund: EJSON.parse(refund),
    };

    const filter = EJSON.parse(filterRaw);

    return { gameConfigs, coll, filter, calc, ...restConfig, _brand: "bet" };
};

export const parseRoundSummaryConfig = (roundSummaryConfig: SchemaRoundSummaryConfig): RoundSummaryConfig => {
    const { gameConfigs, db, coll: rawColl, filter: filterRaw = "{}", calc: rawCalc, ...restConfig } = roundSummaryConfig;
    const { round } = rawColl;
    const { roundId = '"$id"', tickets = '{"$literal":1}', stake, payout, refund } = rawCalc;
    const { name } = gameConfigs;

    const roundCollectionName = name.concat(round);

    const coll: RoundSummaryCollectionConfig = { round: { db, coll: roundCollectionName } };
    const calc: CalculationConfig = {
        roundId: EJSON.parse(roundId),
        tickets: EJSON.parse(tickets),
        stake: EJSON.parse(stake),
        payout: EJSON.parse(payout),
        refund: EJSON.parse(refund),
    };

    const filter = EJSON.parse(filterRaw);

    return { gameConfigs, coll, filter, calc, ...restConfig, _brand: "round" };
};

export const getSourceNamespace = (summaryConfig: SummaryConfig) => {
    if (isBetSummaryConfig(summaryConfig)) {
        const { coll } = summaryConfig;
        return coll.bet;
    } else if (isRoundSummaryConfig(summaryConfig)) {
        const { coll } = summaryConfig;
        return coll.round;
    } else {
        return throwSummaryConfigError(summaryConfig);
    }
};

export const getRoundIdExpr = (summaryConfig: SummaryConfig) => {
    const { calc } = summaryConfig;
    return calc.roundId;
};

export const getTicketRoundIdExpr = (summaryConfig: SummaryConfig) => {
    if (isBetSummaryConfig(summaryConfig)) {
        const { aliases } = summaryConfig;
        return `$${aliases.foreign}`;
    } else if (isRoundSummaryConfig(summaryConfig)) {
        const { calc } = summaryConfig;
        return calc.roundId;
    } else {
        return throwSummaryConfigError(summaryConfig);
    }
};
