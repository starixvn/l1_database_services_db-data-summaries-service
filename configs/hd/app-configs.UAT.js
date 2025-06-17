/** @typedef {import("@ldb/logger").LumiLoggerConfig} LumiLoggerConfig */
/** @typedef {import("@ldb/mongo").ChangeStreamNameSpace} ChangeStreamNameSpace */

import { name, version } from "./metadata.js";

export const environment = "HD-UAT";
export const healthcheckPort = 5000;

/** @type {LumiLoggerConfig} */
export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "http://02812c393657019df80dbfd647c7e444@sentryuat-sc.nebula.prod/24",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1002034115006,
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

const mongoCred = "lmn_summary:%4c%6d%6e%53%75%6d%6d%61%72%79%40%32%32%30%32%37";
const mongoSrv = "10.99.99.53:39520,10.99.99.54:39520,10.99.99.188:39520,10.99.99.187:39520";
const mongoRepl = "SP-UAT";

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
