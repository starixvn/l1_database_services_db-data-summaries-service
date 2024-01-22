import { SERVICE_VERSION } from "./service-version";

const db = {
    credential: `lmn_summary:${encodeURIComponent("LmnSummary@22027")}`,
    server: "10.99.99.187:37201",
    replSet: "SabaL2UAT",
};
const appName = encodeURI("Data Summaries Service");

const environment = "UAT";

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};

export const sentryOptions = {
    dsn: "http://7dfbd85994cb42ff8b92e856bbc96346@10.2.190.51:9009/276",
    environment,
    initialScope: {
        tags: { service: "data-summaries" },
    },
    release: `data-summaries-service@${SERVICE_VERSION}`,
};

export const skynexOptions = {
    token: "0A40aOc7CtpzjbBSJu8KNWQRoXyjRvf9",
    environment,
    conversationIds: { NotiChannel: -1001604444158 },
    proxy: {
        protocol: "http",
        host: "lisasqd-dev.nebula.prod",
        port: 8801,
    },
};

export const hostingPort = 5000;

export const database = {
    url: `mongodb://${db.credential}@${db.server}/admin?authSource=admin&appName=${appName}&replicaSet=${db.replSet}`,
};
