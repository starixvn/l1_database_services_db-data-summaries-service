import { SERVICE_VERSION } from "./service-version";

const db = {
    credential: "lmn_summary:LmnSummary",
    server: "10.10.50.12:39201,10.10.50.13:39201,10.10.50.14:39201",
    replSet: "L2pLocal",
};
const appName = encodeURI("Data Summaries Service");

const environment = "LOCAL-1";

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};

export const sentryOptions = {
    dsn: "https://be2c83ae1b01424ab32f27411f22f8c5@sentry.lumigame.com/77",
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
};

export const hostingPort = 5000;

export const database = {
    url: `mongodb://${db.credential}@${db.server}/admin?authSource=admin&appName=${appName}&replicaSet=${db.replSet}`,
};
