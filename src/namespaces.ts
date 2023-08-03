import { ChangeStreamNameSpace } from "mongodb";

export const namespaces: Record<string, ChangeStreamNameSpace> = {
    summaryConfigCollection: { db: "ops_configs", coll: "summary_configs" },
};
