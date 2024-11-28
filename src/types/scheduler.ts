import type { SchedulerEventDescription, TimerConfig } from "@ldb/scheduler";

export type SchedulerKeys = "SUMMARY_ROUND" | "SUMMARY_TIME";
export type SchedulerConfigs = Record<SchedulerKeys, TimerConfig>;
export type SchedulerEvents = SchedulerEventDescription<SchedulerConfigs>;
