/** @typedef {import("@ldb/logger").LumiLoggerConfig} LumiLoggerConfig */
/** @typedef {import("@ldb/mongo").ChangeStreamNameSpace} ChangeStreamNameSpace */

import { name, version } from "./metadata.js";

export const environment = "HD-LOCAL-0";
export const healthcheckPort = 5000;

/** @type {LumiLoggerConfig} */
export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "https://42cb349f8a4fbd2297e870bb3fc41821@sentry-k8s.lumigame.com/25",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1002034115006,
            slack: "B08GPPK88MS:T08ACMHMMFS:C091FAL49UG",
        },
    },
    environment,
};

const mongoCred = "lmn_summary:LmnSummary";
const mongoSrv = "10.10.50.12:39400,10.10.50.13:39400,10.10.50.14:39400";
const mongoRepl = "SPLocal0";

export const database = {
    mongoURI: `mongodb://${mongoCred}@${mongoSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${mongoRepl}`,
};

export const schedulerConfig = {
    SUMMARY_ROUND: [60_000, 0],
    SUMMARY_TIME: [60_000, 30_000],
    SUMMARY_OPERATOR: [60_000, 0],
};

/** @type {Record<string, ChangeStreamNameSpace>} */
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
};
