import type { LumiLoggerConfig } from "@ldb/logger";
import { name, version } from "./metadata.js";
import type { SchedulerConfigs } from "./types/scheduler.js";

export const environment = "DEV" as const;
export const healthcheckPort = 5000 as const;

export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "https://098a0c6ad1d74e8eb39ec7df895e59e0@sentry.lumigame.com/76",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1001911631568,
            teams: "19:11eb3bf6c3c240fd993eb8048615835c@thread.tacv2",
        },
    },
    environment,
    terminalSeverityLevel: "debug",
} as const satisfies LumiLoggerConfig;

const dbCred = "lmn_summary:LmnSummary" as const;
const dbSrv = "10.10.50.12:39200,10.10.50.13:39200,10.10.50.14:39200" as const;
const dbRepl = "L2Local" as const;

export const database = {
    targetUrl: `mongodb://${dbCred}@${dbSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${dbRepl}`,
} as const;

export const schedulerConfig = {
    SUMMARY_ROUND: [60_000, -5_000],
    SUMMARY_TIME: [60_000, 25_000],
    SUMMARY_OPERATOR: [60_000, 0],
} as const satisfies SchedulerConfigs;
