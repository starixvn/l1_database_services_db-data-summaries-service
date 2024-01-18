import { SERVICE_VERSION } from "./service-version";

const db = {
    credential: "lmn_summary:LmnSummary",
    server: "10.6.48.200:27101,10.6.64.200:27101,10.6.80.200:27101",
    replSet: "L1AWSLocal",
};
const appName = encodeURI("Data Summaries Service");

const environment = "LOCAL-EKS";

export const eventConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: [60_000, 30_000],
};

export const sentryOptions = {
    dsn: "https://098a0c6ad1d74e8eb39ec7df895e59e0@sentry.lumigame.com/76",
    environment,
    initialScope: {
        tags: { service: "data-summaries" },
    },
    release: `data-summaries-service@${SERVICE_VERSION}`,
};

export const skynexOptions = {
    token: "0A40aOc7CtpzjbBSJu8KNWQRoXyjRvf9",
    environment,
    conversationIds: { NotiChannel: -1001964283718 },
};

export const hostingPort = 5000;

export const database = {
    url: `mongodb://${db.credential}@${db.server}/admin?authSource=admin&appName=${appName}&replicaSet=${db.replSet}`,
};
