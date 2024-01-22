import { SERVICE_VERSION } from "./service-version";

const db = {
    credential: "lmn_summary:gyi%2B%5D2%7Cs%3EH1vGL1S%2BNKrklM%7BaB*%3E%5Dz%26p",
    server: "10.99.99.54:27101,10.99.99.53:27102",
    replSet: "SabaMain",
};
const appName = encodeURI("Data Summaries Service");

const environment = "PROD";

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};

export const sentryOptions = {
    dsn: "http://24da377728fa4ea98635f5dfff6785d5@10.2.189.50:9009/163",
    environment,
    initialScope: {
        tags: { service: "data-summaries" },
    },
    release: `data-summaries-service@${SERVICE_VERSION}`,
};

export const skynexOptions = {
    token: "0A40aOc7CtpzjbBSJu8KNWQRoXyjRvf9",
    environment,
    conversationIds: { NotiChannel: -1001893615808 },
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
