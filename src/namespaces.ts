import { ChangeStreamNameSpace } from "mongodb";

export const namespaces: Record<string, ChangeStreamNameSpace> = {
    summaryConfig: { db: "ops_configs", coll: "summary_configs" },
    roundSummaries: { db: "summary", coll: "round_summaries" },
    hourlySummaries: { db: "summary", coll: "hourly_summaries" },
    dailySummaries: { db: "summary", coll: "daily_summaries" },
};
