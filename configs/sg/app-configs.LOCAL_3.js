/** @typedef {import("@ldb/logger").LumiLoggerConfig} LumiLoggerConfig */
/** @typedef {import("@ldb/mongo").ChangeStreamNameSpace} ChangeStreamNameSpace */

import { name, version } from "./metadata.js";

export const environment = "SG-LOCAL-3";
export const healthcheckPort = 5000;

/** @type {LumiLoggerConfig} */
export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "https://65203d3a46ca4b5c95eeba210120b017@sentry-k8s.lumigame.com/21",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1001964283718,
            slack: "B08GPPK88MS:T08ACMHMMFS:C091FAL49UG",
        },
    },
    environment,
};

const mongoCred = "lmn_summary:LmnSummary";
const mongoSrv = "10.10.50.12:39103,10.10.50.13:39103,10.10.50.14:39103";
const mongoRepl = "L1pppLocal";

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
    summaryConfigsNamespace: { db: "ops_configs", coll: "summary_configs" },
    ticketSummariesNamespace: { db: "minigame", coll: "ticket_silos" },
    roundSummariesNamespace: { db: "summary", coll: "round_summaries" },
    hourlySummariesNamespace: { db: "summary", coll: "hourly_summaries" },
    dailySummariesNamespace: { db: "summary", coll: "daily_summaries" },
    hourlyStatementsNamespace: { db: "summary", coll: "hourly_statements" },
    dailyStatementsNamespace: { db: "summary", coll: "daily_statements" },

    operatorRawSummariesNamespace: { db: "minigame", coll: "operator_daily_summaries" },
    operatorDailySummariesNamespace: { db: "summary", coll: "operator_daily_summaries" },
};
