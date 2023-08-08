import {
    BetSummaryConfig,
    RoundSummaryConfig,
    SchemaBetSummaryConfig,
    SchemaRoundSummaryConfig,
    SchemaSummaryConfig,
    SummaryConfig,
} from "../types/summary-config";

export function isBetSummaryConfig(
    summaryConfig: SchemaSummaryConfig | SummaryConfig
): summaryConfig is SchemaBetSummaryConfig | BetSummaryConfig {
    const { _brand, coll } = summaryConfig;
    return _brand === "bet" || ("round" in coll && "bet" in coll);
}
export function isRoundSummaryConfig(
    summaryConfig: SchemaSummaryConfig | SummaryConfig
): summaryConfig is SchemaRoundSummaryConfig | RoundSummaryConfig {
    const { _brand, coll } = summaryConfig;
    return _brand === "round" || ("round" in coll && !("bet" in coll));
}
