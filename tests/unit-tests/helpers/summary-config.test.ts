import { describe, expect, it, jest } from "@jest/globals";
import type { ChangeStreamNameSpace } from "@ldb/mongo";
import {
    getRoundIdExpr,
    getSourceNamespace,
    getTicketRoundIdExpr,
    isBetSummaryConfig,
    isRoundSummaryConfig,
    parseBetSummaryConfig,
    parseRoundSummaryConfig,
    parseSummaryConfig,
    throwSummaryConfigError,
} from "../../../src/helpers/summary-config";
import type {
    BetSummaryConfig,
    RoundSummaryConfig,
    SchemaBetSummaryConfig,
    SchemaRoundSummaryConfig,
    SchemaSummaryConfig,
    SummaryConfig,
} from "../../../src/types/summary-config.ts";

afterAll(() => {
    jest.clearAllMocks();
});

({
    parseSummaryConfig,
    parseBetSummaryConfig,
    parseRoundSummaryConfig,
});

describe("Summary config helpers", () => {
    describe("[function throwSummaryConfigError]", () => {
        it("Throw custom error", () => {
            const summaryConfig = { mock: "SummaryConfig" } as unknown as SummaryConfig;
            let receivedError: any = {};

            try {
                throwSummaryConfigError(summaryConfig);
            } catch (error) {
                receivedError = error;
            }

            expect(receivedError).toBeInstanceOf(TypeError);
            expect(receivedError.message).toBe("Invalid summary config schema");
            expect(receivedError.summaryConfig).toBe(summaryConfig);
        });
    });

    describe("Type guard functions", () => {
        const betConfigs = [
            { coll: { round: "_phiens", bet: "_cuocs" } },
            { coll: { round: "_phiens", bet: "_ones" } },
            { coll: { round: "_rounds", bet: "_bets" } },
            { coll: { round: "_rounds", bet: "_ones" } },
            { coll: { round: { db: "test", coll: "game_phiens" }, bet: { db: "test", coll: "game_cuocs" } } },
            { coll: { round: { db: "test", coll: "game_phiens" }, bet: { db: "test", coll: "game_ones" } } },
            { coll: { round: { db: "test", coll: "game_rounds" }, bet: { db: "test", coll: "game_bets" } } },
            { coll: { round: { db: "test", coll: "game_rounds" }, bet: { db: "test", coll: "game_ones" } } },
            { _brand: "bet" },
        ] as unknown as SummaryConfig[];
        const roundConfigs = [
            { coll: { round: "_rounds" } },
            { coll: { round: "" } },
            { coll: { round: { db: "test", coll: "game_rounds" } } },
            { coll: { round: { db: "test", coll: "game" } } },
            { _brand: "round" },
        ] as unknown as SummaryConfig[];

        it("[function isBetSummaryConfig]", () => {
            for (const testCase of betConfigs) {
                expect(isBetSummaryConfig(testCase)).toBe(true);
            }
            for (const testCase of roundConfigs) {
                expect(isBetSummaryConfig(testCase)).toBe(false);
            }
        });

        it("[function isRoundSummaryConfig]", () => {
            for (const testCase of betConfigs) {
                expect(isRoundSummaryConfig(testCase)).toBe(false);
            }
            for (const testCase of roundConfigs) {
                expect(isRoundSummaryConfig(testCase)).toBe(true);
            }
        });
    });

    describe("[function parseSummaryConfig]", () => {
        it("Parse bet summary config", () => {
            const testCases = [
                [
                    {
                        _brand: "" as unknown as "bet",
                        category: "games",
                        type: 0,
                        gameConfigs: { gameId: 1, name: "taixiu" },
                        db: "minigame",
                        coll: { round: "_phiens", bet: "_ones" },
                        aliases: { foreign: "roundId", playerId: "playerId", settled: "paid", time: "time", subRoundId: "roundId" },
                        calc: {
                            roundId: '"$id"',
                            tickets: '{"$literal":1}',
                            stake: '"$totalAmount"',
                            payout: '"$totalWin"',
                            refund: '"$refund"',
                        },
                    },
                    {
                        _brand: "bet",
                        category: "games",
                        type: 0,
                        gameConfigs: { gameId: 1, name: "taixiu" },
                        coll: { round: { db: "minigame", coll: "taixiu_phiens" }, bet: { db: "minigame", coll: "taixiu_ones" } },
                        filter: {},
                        aliases: { foreign: "roundId", playerId: "playerId", settled: "paid", time: "time", subRoundId: "roundId" },
                        calc: {
                            roundId: "$id",
                            tickets: { $literal: 1 },
                            stake: "$totalAmount",
                            payout: "$totalWin",
                            refund: "$refund",
                        },
                    },
                ],
            ] satisfies [SchemaBetSummaryConfig, BetSummaryConfig][];

            for (const [input, expectedOuput] of testCases) {
                expect(parseSummaryConfig(input)).toEqual(expectedOuput);
            }
        });
        it("Parse round summary config", () => {
            const testCases = [
                [
                    {
                        _brand: "" as unknown as "round",
                        category: "games",
                        type: 0,
                        gameConfigs: { gameId: 47, name: "treasureisland" },
                        db: "minigame",
                        coll: { round: "_rounds" },
                        filter: '{"paid":true}',
                        aliases: { playerId: "playerId", settled: "paid", time: "time", subRoundId: "id" },
                        calc: {
                            roundId: '"$id"',
                            tickets: '{"$literal":1}',
                            stake: '{"$multiply":["$totalAmount",{"$toInt":{"$not":"$freeSpin"}}]}',
                            payout: '"$betwin"',
                            refund: '{"$literal":0}',
                        },
                    },
                    {
                        _brand: "round",
                        category: "games",
                        type: 0,
                        gameConfigs: { gameId: 47, name: "treasureisland" },
                        coll: { round: { db: "minigame", coll: "treasureisland_rounds" } },
                        filter: { paid: true },
                        aliases: { playerId: "playerId", settled: "paid", time: "time", subRoundId: "id" },
                        calc: {
                            roundId: "$id",
                            tickets: { $literal: 1 },
                            stake: { $multiply: ["$totalAmount", { $toInt: { $not: "$freeSpin" } }] },
                            payout: "$betwin",
                            refund: { $literal: 0 },
                        },
                    },
                ],
            ] satisfies [SchemaRoundSummaryConfig, RoundSummaryConfig][];

            for (const [input, expectedOuput] of testCases) {
                expect(parseSummaryConfig(input)).toEqual(expectedOuput);
            }
        });
        it("Throw if provided invalid input", () => {
            const testCases = [
                {
                    _brand: "",
                    category: "games",
                    type: 0,
                    gameConfigs: { gameId: 0, name: "test" },
                    db: "minigame",
                    coll: { bet: "_bets" },
                    filter: '{"paid":true}',
                    aliases: { playerId: "playerId", settled: "paid", time: "time", subRoundId: "id" },
                    calc: {
                        roundId: '"$id"',
                        tickets: '{"$literal":1}',
                        stake: '{"$multiply":["$totalAmount",{"$toInt":{"$not":"$freeSpin"}}]}',
                        payout: '"$betwin"',
                        refund: '{"$literal":0}',
                    },
                },
                {
                    _brand: "",
                    gameConfigs: { gameId: 0, name: "test" },
                    db: "minigame",
                    filter: '{"paid":true}',
                    aliases: { playerId: "playerId", settled: "paid", time: "time", subRoundId: "id" },
                    calc: {
                        roundId: '"$id"',
                        tickets: '{"$literal":1}',
                        stake: '{"$multiply":["$totalAmount",{"$toInt":{"$not":"$freeSpin"}}]}',
                        payout: '"$betwin"',
                        refund: '{"$literal":0}',
                    },
                },
            ] as unknown as SchemaSummaryConfig[];

            for (const input of testCases) {
                expect(() => parseSummaryConfig(input)).toThrowError("Invalid summary config schema");
            }
        });
    });

    describe("[function getSourceNamespace]", () => {
        it("Return correct namespace", () => {
            const testCases = [
                [{ coll: { round: { db: "test", coll: "game_phiens" }, bet: { db: "test", coll: "game_cuocs" } } }, { db: "test", coll: "game_cuocs" }],
                [{ coll: { round: { db: "test", coll: "game_phiens" }, bet: { db: "test", coll: "game_ones" } } }, { db: "test", coll: "game_ones" }],
                [{ coll: { round: { db: "test", coll: "game_rounds" }, bet: { db: "test", coll: "game_bets" } } }, { db: "test", coll: "game_bets" }],
                [{ coll: { round: { db: "test", coll: "game_rounds" }, bet: { db: "test", coll: "game_ones" } } }, { db: "test", coll: "game_ones" }],
                [{ coll: { round: { db: "test", coll: "game_rounds" } } }, { db: "test", coll: "game_rounds" }],
                [{ coll: { round: { db: "test", coll: "game" } } }, { db: "test", coll: "game" }],
            ] as unknown as [SummaryConfig, ChangeStreamNameSpace][];

            for (const [input, expectedOuput] of testCases) {
                expect(getSourceNamespace(input)).toEqual(expectedOuput);
            }
        });
        it("Throw if got invalid input", () => {
            const testCases = [{ coll: {} }, { coll: { bet: { db: "test", coll: "case" } } }, { coll: { data: { db: "test", coll: "case" } } }, {}] as unknown as [SummaryConfig];

            for (const input of testCases) {
                expect(() => getSourceNamespace(input)).toThrowError("Invalid summary config schema");
            }
        });
    });

    describe("[function getRoundIdExpr]", () => {
        it("Return id expression in _rounds collection", () => {
            const testCases = [
                [{ _brand: "bet", calc: { roundId: "$id" }, aliases: { foreign: "$roundId" } }, "$id"],
                [{ _brand: "round", calc: { roundId: "$id" } }, "$id"],
            ] as unknown as [SummaryConfig, string][];

            for (const [input, expectedOuput] of testCases) {
                expect(getRoundIdExpr(input)).toBe(expectedOuput);
            }
        });
    });

    describe("[function getTicketRoundIdExpr]", () => {
        it("Return roundId expression in _bets collection", () => {
            const testCases = [
                [{ _brand: "bet", calc: { roundId: "$id" }, aliases: { foreign: "roundId" } }, "$roundId"],
                [{ _brand: "round", calc: { roundId: "$id" } }, "$id"],
            ] as unknown as [SummaryConfig, string][];

            for (const [input, expectedOuput] of testCases) {
                expect(getTicketRoundIdExpr(input)).toBe(expectedOuput);
            }
        });
        it("Throw when provided invalid input", () => {
            const testCases = [
                { _brand: "", calc: { roundId: "$id" }, aliases: { foreign: "roundId" } },
                { _brand: "", calc: { roundId: "$id" } },
            ] as unknown as SummaryConfig[];

            for (const input of testCases) {
                expect(() => getTicketRoundIdExpr(input)).toThrowError("Invalid summary config schema");
            }
        });
    });
});
