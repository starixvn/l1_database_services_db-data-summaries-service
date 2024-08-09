/** @typedef {import("@ldb/base-logger").SeverityLevel} SeverityLevel */
/** @typedef {import("@ldb/sentry-logger").NodeOptions} NodeOptions */
/** @typedef {import("@ldb/sentry-logger").SentryOptions} SentryOptions */
/** @typedef {import("@ldb/skynex-logger").SkynexOptions} SkynexOptions */

import { name, version } from "./metadata.js";

export const environment = "XD-SIT";
export const healthcheckPort = 5000;

/** @type {SeverityLevel} */
export const sentrySeverityLevel = "warning";
/** @type {NodeOptions} */
export const sentryNodeOptions = {
    dsn: "http://deb8a0a2ea0e4788a8d19b9aee8b2aa9@10.2.190.51:9009/297",
    environment,
    initialScope: {
        tags: { service: name },
    },
    release: `${name}@${version}`,
};
/** @type {SentryOptions} */
export const sentryOptions = {};

/** @type {SeverityLevel} */
export const skynexSeverityLevel = "warning";
/** @type {SkynexOptions} */
export const skynexOptions = {
    conversationIds: {
        telegram: -1002034115006,
        teams: "19:d7150ed870de4bef928c69ea6949c6ff@thread.tacv2",
    },
    proxy: {
        protocol: "http",
        host: "lisasqd.nebula.prod",
        port: 8801,
    },
};

/** @type {SeverityLevel} */
export const terminalSeverityLevel = "log";

const dbCred = "lmn_summary:%4c%6d%6e%53%75%6d%6d%61%72%79%40%35%31%37";
const dbSrv = "10.99.99.53:39430,10.99.99.54:39430,10.99.99.188:39430,10.99.99.187:39430";
const dbRepl = "SN-SIT";

export const database = {
    targetUrl: `mongodb://${dbCred}@${dbSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${dbRepl}`,
};

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};
