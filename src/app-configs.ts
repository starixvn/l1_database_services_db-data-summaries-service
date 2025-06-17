import type { LumiLoggerConfig } from "@ldb/logger";
import type { ChangeStreamNameSpace } from "@ldb/mongo";
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
const dbSrv = "10.10.50.12:39400,10.10.50.13:39400,10.10.50.14:39400" as const;
const dbRepl = "SPLocal0" as const;

export const database = {
    targetUrl: `mongodb://${dbCred}@${dbSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${dbRepl}`,
} as const;

export const schedulerConfig = {
    SUMMARY_ROUND: [60_000, -5_000],
    SUMMARY_TIME: [60_000, 25_000],
    SUMMARY_OPERATOR: [60_000, 0],
} as const satisfies SchedulerConfigs;

export const namespaces = {
    summaryConfigsNamespace: { db: "ops_configs", coll: "hotdog_summary_configs" },
    ticketSummariesNamespace: { db: "hotdog_minigame", coll: "ticket_silos" },
    roundSummariesNamespace: { db: "hotdog_summary", coll: "round_summaries" },
    hourlySummariesNamespace: { db: "hotdog_summary", coll: "hourly_summaries" },
    dailySummariesNamespace: { db: "hotdog_summary", coll: "daily_summaries" },
    hourlyStatementsNamespace: { db: "hotdog_summary", coll: "hourly_statements" },
    dailyStatementsNamespace: { db: "hotdog_summary", coll: "daily_statements" },

    operatorRawSummariesNamespace: { db: "hotdog_minigame", coll: "operator_daily_summaries" },
    operatorDailySummariesNamespace: { db: "hotdog_summary", coll: "operator_daily_summaries" },
} as const satisfies Record<string, ChangeStreamNameSpace>;
