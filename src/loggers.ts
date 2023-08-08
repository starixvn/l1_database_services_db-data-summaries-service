import { stringify } from "@ldb/utils";
import { SentryLogger } from "@sc-logger/sentry";
import { SkynexLogger } from "@sc-logger/skynex";
import { TerminalLogger } from "@sc-logger/terminal";
import { sentryOptions, skynexOptions } from "./app-configs";

export const LoggerMask = {
    NONE: 0,
    SENTRY: 1,
    SKYNEX: 2,
} as const;

export const sentry = new SentryLogger(sentryOptions);

export const skynex = new SkynexLogger(skynexOptions);

const { NODE_ENV: nodeEnv = "DEVELOPMENT" } = process.env;
const defaultSeverityLevel = nodeEnv === "DEVELOPMENT" ? "debug" : "log";
export const terminal = new TerminalLogger(defaultSeverityLevel);

export const logger = {
    logDebug(...args: Parameters<TerminalLogger["logDebug"]>) {
        terminal.logDebug(...args);
    },
    logInfo(component: string, message: string, manual: boolean, extra: Record<string, unknown> = {}) {
        terminal.logInfo("", { title: component, subject: message.replace(/`/g, "") });

        if (!manual) {
            skynex.logInfo(message);
            sentry.logInfo(message.replace(/`/g, ""), { extra });
        }
    },
    logWarning(component: string, message: string) {
        terminal.logWarning("", { title: component, subject: message });
    },
    logError(component: string, error: unknown, extra: Record<string, unknown> = {}, mask: number = LoggerMask.SENTRY | LoggerMask.SKYNEX) {
        const tags = { title: component };
        terminal.logError(error, tags);

        if (mask & LoggerMask.SENTRY) {
            sentry.logError(error, { tags, extra });
        }

        if (mask & LoggerMask.SKYNEX) {
            const message = [component, "```", stringify(error, false), "```", "```", stringify(extra, false), "```"].join("\n");
            skynex.logError(message);
        }
    },
    logFatal(component: string, error: unknown, extra: Record<string, unknown> = {}, mask: number = LoggerMask.SENTRY | LoggerMask.SKYNEX) {
        const tags = { title: component };
        terminal.logFatal(error, tags);

        if (mask & LoggerMask.SENTRY) {
            sentry.logFatal(error, { tags, extra });
        }

        if (mask & LoggerMask.SKYNEX) {
            const message = [component, "```", stringify(error, false), "```", "```", stringify(extra, false), "```"].join("\n");
            skynex.logFatal(message);
        }
    },
};
