/** @typedef {import("@ldb/logger").LumiLoggerConfig} LumiLoggerConfig */
/** @typedef {import("@ldb/mongo").ChangeStreamNameSpace} ChangeStreamNameSpace */

import { name, version } from "./metadata.js";

export const environment = "SG-SIT";
export const healthcheckPort = 5000;

/** @type {LumiLoggerConfig} */
export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "http://a4e9d446189bcd2464e4449f67506eb3@sentryuat-sc.nebula.prod/21",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1001964283718,
            slack: "B08GPPK88MS:T08ACMHMMFS:C090ALHP2DD",
        },
        proxy: {
            protocol: "http",
            host: "lisasqd.nebula.prod",
            port: 8801,
        },
    },
    environment,
};

const mongoCred = "lmn_summary:%4c%6d%6e%53%75%6d%6d%61%72%79%40%35%31%37";
const mongoSrv = "10.99.99.53:39130,10.99.99.54:39130,10.99.99.188:39130,10.99.99.187:39130";
const mongoRepl = "SabaSIT";

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
