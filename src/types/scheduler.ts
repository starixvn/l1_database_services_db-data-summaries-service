import type { FireListener, Scheduler, SchedulerConfigs as SchedulerConfigsUpstream, SchedulerValue } from "@ldb/scheduler";
type Satisfies<T extends U, U> = T;
export type SchedulerKeys = "SUMMARY_ROUND" | "SUMMARY_TIME";
export type SchedulerEvents = Record<SchedulerKeys, FireListener>;
export type SchedulerConfigs = Satisfies<Record<SchedulerKeys, number | SchedulerValue>, SchedulerConfigsUpstream>;
export type { Scheduler };
