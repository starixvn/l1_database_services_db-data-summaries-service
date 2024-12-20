/** @typedef {import("@ldb/logger").LumiLoggerConfig} LumiLoggerConfig */

import { name, version } from "./metadata.js";

export const environment = "SG-PROD";
export const healthcheckPort = 5000;

/** @type {LumiLoggerConfig} */
export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "http://d84f2c9daa5044c48bca9930aa7e98b0@10.2.189.50:9009/168",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1001893615808,
            teams: "19:61ccda09f02444a9ab8355852903a598@thread.tacv2",
        },
        proxy: {
            protocol: "http",
            host: "lisasqd.nebula.prod",
            port: 8801,
        },
    },
    environment,
};

const dbCred = "lmn_summary:%67%79%69%2b%5d%32%7c%73%3e%48%31%76%47%4c%31%53%2b%4e%4b%72%6b%6c%4d%7b%61%42%2a%3e%5d%7a%26%70";
const dbSrv = "10.99.99.53:39110,10.99.99.54:39110,10.99.99.188:39110,10.99.99.187:39110";
const dbRepl = "SabaMain";

export const database = {
    targetUrl: `mongodb://${dbCred}@${dbSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${dbRepl}`,
};

export const schedulerConfig = {
    SUMMARY_ROUND: [60_000, 0],
    SUMMARY_TIME: [60_000, 30_000],
    SUMMARY_OPERATOR: [60_000, 0],
};
