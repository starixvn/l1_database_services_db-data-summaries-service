import { SchedulerConfigs } from "@ldb/scheduler";
import { NodeOptions } from "@sc-logger/sentry";
import { SkynexConfigs } from "@sc-logger/skynex";
import { SERVICE_VERSION } from "./service-version";

const db = {
    credential: "lmn_summary:LmnSummary",
    server: "10.10.50.12:39200,10.10.50.13:39200,10.10.50.14:39200",
    replSet: "L2Local",
};
const appName = encodeURI("Data Summaries DevMode");

const environment = "LOCAL-DEV";

export const eventConfigs: SchedulerConfigs = {
    SUMMARY_ROUND: 60_000,
    SUMMARY_TIME: 10 * 60_000,
};

export const sentryOptions: NodeOptions = {
    dsn: "https://098a0c6ad1d74e8eb39ec7df895e59e0@sentry.lumigame.com/76",
    environment,
    initialScope: {
        tags: { service: "data-summaries" },
    },
    release: `data-summaries-service@${SERVICE_VERSION}`,
};

export const skynexOptions: SkynexConfigs = {
    token: "0A40aOc7CtpzjbBSJu8KNWQRoXyjRvf9",
    environment,
    conversationIds: { NotiChannel: -1001911631568 },
};

export const hostingPort = 5000;

export const database = {
    url: `mongodb://${db.credential}@${db.server}/admin?authSource=admin&appName=${appName}&replicaSet=${db.replSet}`,
};
