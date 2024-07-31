/** @typedef {import("@ldb/base-logger").SeverityLevel} SeverityLevel */
/** @typedef {import("@ldb/sentry-logger").NodeOptions} NodeOptions */
/** @typedef {import("@ldb/sentry-logger").SentryOptions} SentryOptions */
/** @typedef {import("@ldb/skynex-logger").SkynexOptions} SkynexOptions */

import { name, version } from "./metadata.js";

export const environment = "SG-LOCAL-3";
export const healthcheckPort = 5000;

/** @type {SeverityLevel} */
export const sentrySeverityLevel = "warning";
/** @type {NodeOptions} */
export const sentryNodeOptions = {
    dsn: "https://098a0c6ad1d74e8eb39ec7df895e59e0@sentry.lumigame.com/76",
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
        telegram: -1001964283718,
        teams: "19:b9580a426bbe409fb9457129f486c63b@thread.tacv2",
    },
};

/** @type {SeverityLevel} */
export const terminalSeverityLevel = "log";

const dbCred = "lmn_summary:LmnSummary";
const dbSrv = "10.10.50.12:39103,10.10.50.13:39103,10.10.50.14:39103";
const dbRepl = "L1pppLocal";

export const database = {
    targetUrl: `mongodb://${dbCred}@${dbSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${dbRepl}`,
};

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};
