import { EJSON } from "bson";
import {
    BetSummaryCollectionConfig,
    BetSummaryConfig,
    CalculationConfig,
    RoundSummaryCollectionConfig,
    RoundSummaryConfig,
    SchemaBetSummaryConfig,
    SchemaRoundSummaryConfig,
    SchemaSummaryConfig,
    SummaryConfig,
} from "../types/summary-config";
import { isBetSummaryConfig, isRoundSummaryConfig } from "./type-guards";

export function parseSummaryConfig(betSummaryConfig: SchemaBetSummaryConfig): BetSummaryConfig;
export function parseSummaryConfig(roundSummaryConfig: SchemaRoundSummaryConfig): RoundSummaryConfig;
export function parseSummaryConfig(summaryConfig: SchemaSummaryConfig): SummaryConfig;
export function parseSummaryConfig(summaryConfig: SchemaSummaryConfig): SummaryConfig {
    if (isBetSummaryConfig(summaryConfig)) {
        const {
            gameConfigs,
            db,
            coll: { round, bet },
            filter: filterRaw = "{}",
            calc: { tickets = '{"$literal":1}', stake, payout, refund },
            ...restConfig
        } = summaryConfig;

        const { name } = gameConfigs;
        const roundCollectionName = [name, round].filter(Boolean).join("");
        const betCollectionName = [name, bet].filter(Boolean).join("");

        const coll: BetSummaryCollectionConfig = { round: { db, coll: roundCollectionName }, bet: betCollectionName };
        const calc: CalculationConfig = { tickets: EJSON.parse(tickets), stake: EJSON.parse(stake), payout: EJSON.parse(payout), refund: EJSON.parse(refund) };

        const filter = EJSON.parse(filterRaw);

        return { gameConfigs, coll, filter, calc, ...restConfig, _brand: "bet" };
    } else if (isRoundSummaryConfig(summaryConfig)) {
        const {
            gameConfigs,
            db,
            coll: { round },
            filter: filterRaw = "{}",
            calc: { tickets = "1", stake, payout, refund },
            ...restConfig
        } = summaryConfig;

        const { name } = gameConfigs;
        const roundCollectionName = [name, round].filter(Boolean).join("");

        const coll: RoundSummaryCollectionConfig = { round: { db, coll: roundCollectionName } };
        const calc: CalculationConfig = { tickets: EJSON.parse(tickets), stake: EJSON.parse(stake), payout: EJSON.parse(payout), refund: EJSON.parse(refund) };

        const filter = EJSON.parse(filterRaw);

        return { gameConfigs, coll, filter, calc, ...restConfig, _brand: "round" };
    } else {
        throw new Error("Invalid config");
    }
}
