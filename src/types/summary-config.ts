import { Document } from "bson";

export type FromBetCollectionConfig = {
    round: string;
    bet: string;
};
export type FromRoundCollectionConfig = {
    round: string;
};

export type AliasField = "local" | "foreign" | "time" | "playerId" | "settled";
export type AliasConfig = Record<AliasField, string>;

export type CalculationField = "stake" | "payout" | "refund";
export type CalculationConfigRaw = Record<CalculationField, string>;
export type CalculationConfig = Record<CalculationField, string | Document | Document[]>;

export type SummaryConfigBase<TCategory extends string, TType extends number | string> = {
    category: TCategory;
    type: TType;
};

export type GameSummaryConfigBase<TType extends number> = SummaryConfigBase<"games", TType> & {
    gameConfigs: { gameId: number; name: string };
    db: string;
};
export type FromBetSummaryConfigBase = GameSummaryConfigBase<0> & {
    coll: FromBetCollectionConfig;
    aliases: AliasConfig;
};
export type FromRoundSummaryConfigBase = GameSummaryConfigBase<2> & {
    coll: FromRoundCollectionConfig;
    aliases: Omit<AliasConfig, "foreign">;
    jackpotContribution: number;
};

export type FromBetSummaryConfigRaw = FromBetSummaryConfigBase & {
    calc: CalculationConfigRaw;
};
export type FromRoundSummaryConfigRaw = FromRoundSummaryConfigBase & {
    calc: CalculationConfigRaw;
};
export type SummaryConfigRaw = FromBetSummaryConfigRaw | FromRoundSummaryConfigRaw;

export type FromBetSummaryConfig = FromBetSummaryConfigBase & {
    calc: CalculationConfig;
};
export type FromRoundSummaryConfig = FromRoundSummaryConfigBase & {
    calc: CalculationConfig;
};
export type SummaryConfig = FromBetSummaryConfig | FromRoundSummaryConfig;

export type PipelineFactory<TConfig extends SummaryConfig> = (...args: [TConfig]) => Document[];
