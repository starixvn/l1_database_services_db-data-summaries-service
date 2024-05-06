import { ChangeStreamNameSpace, Document } from "@ldb/mongo";

export type GameConfigInfo = { gameId: number; name: string };

export type SchemaBetSummaryCollectionConfig = Record<"round" | "bet", string>;

export type CommonSummaryAliases = "time" | "playerId" | "settled";

export type BetSummaryAliasConfig = Record<"foreign" | CommonSummaryAliases, string>;

export type CalculationField = "roundId" | "tickets" | "stake" | "payout" | "refund";

export type SchemaCalculationConfig = Record<CalculationField, string>;

export type SchemaBetSummaryConfig = {
    _brand: "bet";
    category: string;
    type: number;
    gameConfigs: GameConfigInfo;
    db: string;
    coll: SchemaBetSummaryCollectionConfig;
    filter?: string;
    aliases: BetSummaryAliasConfig;
    calc: SchemaCalculationConfig;
};

export type SchemaRoundSummaryCollectionConfig = Record<"round", string>;

export type RoundSummaryAliasConfig = Record<CommonSummaryAliases, string>;

export type SchemaRoundSummaryConfig = {
    _brand: "round";
    category: string;
    type: number;
    gameConfigs: GameConfigInfo;
    db: string;
    coll: SchemaRoundSummaryCollectionConfig;
    filter?: string;
    aliases: RoundSummaryAliasConfig;
    calc: SchemaCalculationConfig;
};

export type SchemaSummaryConfig = SchemaBetSummaryConfig | SchemaRoundSummaryConfig;

export type BetSummaryCollectionConfig = { round: ChangeStreamNameSpace; bet: ChangeStreamNameSpace };

export type CalculationConfig = Record<CalculationField, string | Document | Document[]>;

export type BetSummaryConfig = {
    _brand: "bet";
    category: string;
    type: number;
    gameConfigs: GameConfigInfo;
    coll: BetSummaryCollectionConfig;
    filter: Document;
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
    filter: Document;
    aliases: RoundSummaryAliasConfig;
    calc: CalculationConfig;
};

export type SummaryConfig = BetSummaryConfig | RoundSummaryConfig;
