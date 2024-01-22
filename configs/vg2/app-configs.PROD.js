import { SERVICE_VERSION } from "./service-version";

const db = {
    credential: "lmn_summary:XE%3F3cEh%26tXMc%60GY%5Eveuj%24N%2Brb~3S5toD",
    server: "10.99.99.53:37101,10.99.99.54:37102",
    replSet: "L2_SabaMain",
};
const appName = encodeURI("Data Summaries Service");

const environment = "PROD";

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};

export const sentryOptions = {
    dsn: "http://0d16904ac82244349459372e629d8d39@10.2.189.50:9009/165",
    environment,
    initialScope: {
        tags: { service: "data-summaries" },
    },
    release: `data-summaries-service@${SERVICE_VERSION}`,
};

export const skynexOptions = {
    token: "0A40aOc7CtpzjbBSJu8KNWQRoXyjRvf9",
    environment,
    conversationIds: { NotiChannel: -1001948416210 },
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
