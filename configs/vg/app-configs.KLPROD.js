/** @typedef {import("@ldb/logger").LumiLoggerConfig} LumiLoggerConfig */
/** @typedef {import("@ldb/mongo").ChangeStreamNameSpace} ChangeStreamNameSpace */

import { name, version } from "./metadata.js";

export const environment = "VG-KL-PROD";
export const healthcheckPort = 5000;

/** @type {LumiLoggerConfig} */
export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "http://6dedea44b8f8e60b6519ff864484357a@sentrypro-sc.ops-klprod.gamora.prod/20",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1001948416210,
            slack: "B08GPPK88MS:T08ACMHMMFS:C090GANNXP1",
        },
        proxy: {
            protocol: "http",
            host: "iusqd.gamora.prod",
            port: 8801,
        },
    },
    environment,
};

const mongoCred = "lmn_summary:%58%45%3f%33%63%45%68%26%74%58%4d%63%60%47%59%5e%76%65%75%6a%24%4e%2b%72%62%7e%33%53%35%74%6f%44";
const mongoSrv = "10.146.34.26:39210,10.146.34.27:39210,10.146.34.30:39210,10.146.34.28:39210";
const mongoRepl = "L2_SabaMain";

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
