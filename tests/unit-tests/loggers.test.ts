import { jest } from "@jest/globals";
import { LoggerMask, logger, sentry, skynex, terminal } from "../../src/loggers";

afterEach(() => {
    jest.clearAllMocks();
});

describe("Loggers", () => {
    describe("Custom logger", () => {
        describe("logInfo", () => {
            const spyTerminal = jest.spyOn(terminal, "logInfo").mockImplementation(() => null);
            const spySkynex = jest.spyOn(skynex, "logInfo").mockImplementation(() => null);
            const spySentry = jest.spyOn(sentry, "logInfo").mockImplementation(() => null);

            it("No format, manual = true, no extra", () => {
                logger.logInfo("unit-test", "Test logInfo call", true);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logInfo call" });
                expect(spySkynex).toHaveBeenCalledTimes(0);
                expect(spySentry).toHaveBeenCalledTimes(0);
            });
            it("No format, manual = true, with extra", () => {
                logger.logInfo("unit-test", "Test logInfo call", true, { a: 1 });
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logInfo call" });
                expect(spySkynex).toHaveBeenCalledTimes(0);
                expect(spySentry).toHaveBeenCalledTimes(0);
            });

            it("No format, manual = false, no extra", () => {
                logger.logInfo("unit-test", "Test logInfo call", false);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logInfo call" });
                expect(spySkynex).toHaveBeenCalledTimes(1);
                expect(spySkynex).toHaveBeenLastCalledWith("Test logInfo call");
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith("Test logInfo call", { extra: {} });
            });
            it("No format, manual = false, with extra", () => {
                logger.logInfo("unit-test", "Test logInfo call", false, { a: 1 });
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logInfo call" });
                expect(spySkynex).toHaveBeenCalledTimes(1);
                expect(spySkynex).toHaveBeenLastCalledWith("Test logInfo call");
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith("Test logInfo call", { extra: { a: 1 } });
            });

            it("With format, manual = true, no extra", () => {
                logger.logInfo("unit-test", "Test `logInfo` call", true);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logInfo call" });
                expect(spySkynex).toHaveBeenCalledTimes(0);
                expect(spySentry).toHaveBeenCalledTimes(0);
            });
            it("With format, manual = true, with extra", () => {
                logger.logInfo("unit-test", "Test `logInfo` call", true, { a: 1 });
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logInfo call" });
                expect(spySkynex).toHaveBeenCalledTimes(0);
                expect(spySentry).toHaveBeenCalledTimes(0);
            });

            it("With format, manual = false, no extra", () => {
                logger.logInfo("unit-test", "Test `logInfo` call", false);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logInfo call" });
                expect(spySkynex).toHaveBeenCalledTimes(1);
                expect(spySkynex).toHaveBeenLastCalledWith("Test `logInfo` call");
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith("Test logInfo call", { extra: {} });
            });
            it("With format, manual = false, with extra", () => {
                logger.logInfo("unit-test", "Test `logInfo` call", false, { a: 1 });
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logInfo call" });
                expect(spySkynex).toHaveBeenCalledTimes(1);
                expect(spySkynex).toHaveBeenLastCalledWith("Test `logInfo` call");
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith("Test logInfo call", { extra: { a: 1 } });
            });
        });

        it("logWarning", () => {
            const spyTerminal = jest.spyOn(terminal, "logWarning").mockImplementation(() => null);
            logger.logWarning("unit-test", "Test logWarning call");
            expect(spyTerminal).toHaveBeenCalledTimes(1);
            expect(spyTerminal).toHaveBeenLastCalledWith("", { title: "unit-test", subject: "Test logWarning call" });
        });

        describe("logError", () => {
            const spyTerminal = jest.spyOn(terminal, "logError").mockImplementation(() => null);
            const spySentry = jest.spyOn(sentry, "logError").mockImplementation(() => null);
            const spySkynex = jest.spyOn(skynex, "logError").mockImplementation(() => null);
            const mockError = new Error("Test logError call");

            it("With extra", () => {
                logger.logError("unit-test", mockError, { data: 1 });
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith(mockError, { tags: { title: "unit-test" }, extra: { data: 1 } });
                expect(spySkynex).toHaveBeenCalledTimes(1);
            });
            it("No extra", () => {
                logger.logError("unit-test", mockError);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith(mockError, { tags: { title: "unit-test" }, extra: {} });
                expect(spySkynex).toHaveBeenCalledTimes(1);
            });

            it("Skynex mask", () => {
                logger.logError("unit-test", mockError, {}, LoggerMask.SKYNEX);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(0);
                expect(spySkynex).toHaveBeenCalledTimes(1);
            });

            it("Sentry mask", () => {
                logger.logError("unit-test", mockError, {}, LoggerMask.SENTRY);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith(mockError, { tags: { title: "unit-test" }, extra: {} });
                expect(spySkynex).toHaveBeenCalledTimes(0);
            });

            it("No mask", () => {
                logger.logError("unit-test", mockError, {}, LoggerMask.NONE);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(0);
                expect(spySkynex).toHaveBeenCalledTimes(0);
            });
        });

        describe("logFatal", () => {
            const spyTerminal = jest.spyOn(terminal, "logFatal").mockImplementation(() => null);
            const spySentry = jest.spyOn(sentry, "logFatal").mockImplementation(() => null);
            const spySkynex = jest.spyOn(skynex, "logFatal").mockImplementation(() => null);
            const mockError = new Error("Test logFatal call");

            it("With extra", () => {
                logger.logFatal("unit-test", mockError, { data: 1 });
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith(mockError, { tags: { title: "unit-test" }, extra: { data: 1 } });
                expect(spySkynex).toHaveBeenCalledTimes(1);
            });
            it("No extra", () => {
                logger.logFatal("unit-test", mockError);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith(mockError, { tags: { title: "unit-test" }, extra: {} });
                expect(spySkynex).toHaveBeenCalledTimes(1);
            });

            it("Skynex mask", () => {
                logger.logFatal("unit-test", mockError, {}, LoggerMask.SKYNEX);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(0);
                expect(spySkynex).toHaveBeenCalledTimes(1);
            });

            it("Sentry mask", () => {
                logger.logFatal("unit-test", mockError, {}, LoggerMask.SENTRY);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(1);
                expect(spySentry).toHaveBeenLastCalledWith(mockError, { tags: { title: "unit-test" }, extra: {} });
                expect(spySkynex).toHaveBeenCalledTimes(0);
            });

            it("No mask", () => {
                logger.logFatal("unit-test", mockError, {}, LoggerMask.NONE);
                expect(spyTerminal).toHaveBeenCalledTimes(1);
                expect(spyTerminal).toHaveBeenLastCalledWith(mockError, { title: "unit-test" });
                expect(spySentry).toHaveBeenCalledTimes(0);
                expect(spySkynex).toHaveBeenCalledTimes(0);
            });
        });
    });
});
