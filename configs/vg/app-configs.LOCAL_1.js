import { name, version } from "./metadata.js";

export const environment = "VG-LOCAL-1";
export const healthcheckPort = 5000;

export const sentrySeverityLevel = "warning";
export const sentryNodeOptions = {
    dsn: "https://be2c83ae1b01424ab32f27411f22f8c5@sentry.lumigame.com/77",
    environment,
    initialScope: {
        tags: { service: name },
    },
    release: `${name}@${version}`,
};
export const sentryOptions = {};

export const skynexSeverityLevel = "warning";
export const skynexOptions = {
    conversationIds: {
        telegram: -1001604444158,
        teams: "19:8d4e742134134c3893e78891257d6c3c@thread.tacv2",
    },
};

export const terminalSeverityLevel = "log";

const dbCred = "lmn_summary:LmnSummary";
const dbSrv = "10.10.50.12:39201,10.10.50.13:39201,10.10.50.14:39201";
const dbRepl = "L2pLocal";

export const database = {
    targetUrl: `mongodb://${dbCred}@${dbSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${dbRepl}`,
};

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};
