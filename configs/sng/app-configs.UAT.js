import { SERVICE_VERSION } from "./service-version";

const db = {
    credential: `lmn_summary:${encodeURIComponent("LmnSummary@517")}`,
    server: "10.99.99.53:39420,10.99.99.54:39420,10.99.99.188:39420,10.99.99.187:39420",
    replSet: "SN-UAT",
};
const appName = encodeURI("Data Summaries Service");

const environment = "SIT";

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};

export const sentryOptions = {
    dsn: "https://deb8a0a2ea0e4788a8d19b9aee8b2aa9@10.2.190.51:9009/297",
    environment,
    initialScope: {
        tags: { service: "data-summaries" },
    },
    release: `data-summaries-service@${SERVICE_VERSION}`,
};

export const skynexOptions = {
    token: "0A40aOc7CtpzjbBSJu8KNWQRoXyjRvf9",
    environment,
    conversationIds: { NotiChannel: -1002034115006 },
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
