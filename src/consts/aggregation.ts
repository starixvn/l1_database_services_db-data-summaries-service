import type { AggregateOptions } from "@ldb/mongo";

export const AGGREGATE_OPTIONS = { allowDiskUse: true } as const satisfies AggregateOptions;
