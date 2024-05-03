import type { SeverityLevel } from "@ldb/base-logger";
import type { NodeOptions, SentryOptions } from "@ldb/sentry-logger";
import type { SkynexOptions } from "@ldb/skynex-logger";
import { name, version } from "./metadata.js";
import type { SchedulerConfigs } from "./types/scheduler.js";

export const environment = "DEV" as const;
export const healthcheckPort = 5000 as const;

export const sentrySeverityLevel = "warning" as const satisfies SeverityLevel;
export const sentryNodeOptions = {
    dsn: "https://098a0c6ad1d74e8eb39ec7df895e59e0@sentry.lumigame.com/76",
    environment,
    initialScope: {
        tags: { service: name },
    },
    release: `${name}@${version}`,
} as const satisfies NodeOptions;
export const sentryOptions = {} as const satisfies SentryOptions;

export const skynexSeverityLevel = "warning" as const satisfies SeverityLevel;
export const skynexOptions = {
    conversationIds: {
        telegram: -1001911631568,
        teams: "19:11eb3bf6c3c240fd993eb8048615835c@thread.tacv2",
    },
} as const satisfies SkynexOptions;

export const terminalSeverityLevel = "debug" as const satisfies SeverityLevel;

const dbCred = "lmn_summary:LmnSummary" as const;
const dbSrv = "10.10.50.12:39100,10.10.50.13:39100,10.10.50.14:39100" as const;
const dbRepl = "L1Local" as const;

export const database = {
    targetUrl: `mongodb://${dbCred}@${dbSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${dbRepl}`,
} as const;

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
} as const satisfies SchedulerConfigs;
