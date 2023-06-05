import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
    // preset: "ts-jest",
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    bail: 5,
    clearMocks: true,
    collectCoverage: false,
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["/node_modules/"],
    setupFilesAfterEnv: ["jest-extended"],
    verbose: true,
    extensionsToTreatAsEsm: [".ts"],
    transform: {
        "^.+\\.(ts|tsx)?$": ["ts-jest", { useESM: true }],
    },
    testResultsProcessor: "jest-sonar-reporter",
    reporters: ["default", ["jest-html-reporters", { publicPath: "./reports", filename: "report.html" }]],
};
export default config;
