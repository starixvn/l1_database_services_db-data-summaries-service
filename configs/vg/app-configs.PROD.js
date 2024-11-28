/** @typedef {import("@ldb/logger").LumiLoggerConfig} LumiLoggerConfig */

import { name, version } from "./metadata.js";

export const environment = "VG-PROD";
export const healthcheckPort = 5000;

/** @type {LumiLoggerConfig} */
export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "http://bb368dd4964d4f28bdeec2494d4742bf@10.2.189.50:9009/169",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1001948416210,
            teams: "19:4cc06ce67599405ead9238b3408147f7@thread.tacv2",
        },
        proxy: {
            protocol: "http",
            host: "lisasqd.nebula.prod",
            port: 8801,
        },
    },
    environment,
};

const dbCred = "lmn_summary:%58%45%3f%33%63%45%68%26%74%58%4d%63%60%47%59%5e%76%65%75%6a%24%4e%2b%72%62%7e%33%53%35%74%6f%44";
const dbSrv = "10.99.99.53:39210,10.99.99.54:39210,10.99.99.188:39210,10.99.99.187:39210";
const dbRepl = "L2_SabaMain";

export const database = {
    targetUrl: `mongodb://${dbCred}@${dbSrv}/admin?authSource=admin&appName=${encodeURIComponent(name)}&replicaSet=${dbRepl}`,
};

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};
