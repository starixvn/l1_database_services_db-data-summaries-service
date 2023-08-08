import { ChangeStreamNameSpace, Document } from "mongodb";

export type GameConfigInfo = { gameId: number; name: string };

export type SchemaBetSummaryCollectionConfig = Record<"round" | "bet", string>;

export type BetSummaryAliasConfig = Record<"local" | "foreign" | "time" | "playerId" | "settled", string>;

export type CalculationField = "stake" | "payout" | "refund";

export type SchemaCalculationConfig = Record<CalculationField, string>;

export type SchemaBetSummaryConfig = {
    _brand: "bet";
    category: string;
    type: number;
    gameConfigs: GameConfigInfo;
    db: string;
    coll: SchemaBetSummaryCollectionConfig;
    aliases: BetSummaryAliasConfig;
    calc: SchemaCalculationConfig;
};

export type SchemaRoundSummaryCollectionConfig = Record<"round", string>;

export type RoundSummaryAliasConfig = Record<"local" | "time" | "playerId" | "settled", string>;

export type SchemaRoundSummaryConfig = {
    _brand: "round";
    category: string;
    type: number;
    gameConfigs: GameConfigInfo;
    db: string;
    coll: SchemaRoundSummaryCollectionConfig;
    aliases: RoundSummaryAliasConfig;
    calc: SchemaCalculationConfig;
};

export type SchemaSummaryConfig = SchemaBetSummaryConfig | SchemaRoundSummaryConfig;

export type BetSummaryCollectionConfig = { round: ChangeStreamNameSpace; bet: string };

export type CalculationConfig = Record<CalculationField, string | Document | Document[]>;

export type BetSummaryConfig = {
    _brand: "bet";
    category: string;
    type: number;
    gameConfigs: GameConfigInfo;
    coll: BetSummaryCollectionConfig;
    aliases: BetSummaryAliasConfig;
    calc: CalculationConfig;
};

export type RoundSummaryCollectionConfig = { round: ChangeStreamNameSpace };

export type RoundSummaryConfig = {
    _brand: "round";
    category: string;
    type: number;
    gameConfigs: GameConfigInfo;
    coll: RoundSummaryCollectionConfig;
    aliases: RoundSummaryAliasConfig;
    calc: CalculationConfig;
};

export type SummaryConfig = BetSummaryConfig | RoundSummaryConfig;
