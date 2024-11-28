import type { BaseLogger } from "@ldb/logger";
import type { Scheduler } from "@ldb/scheduler";
import { Dispatcher } from "@ldb/utils";
import type { SchedulerEvents, SchedulerKeys } from "../types/scheduler.js";

export type TimeKeys = "HOURLY" | "DAILY";
export type TimeInitiatorEvents = Record<TimeKeys, () => Promise<void>>;

export class TimeInitiator extends Dispatcher<TimeInitiatorEvents, Pick<SchedulerEvents, "SUMMARY_TIME">> {
    constructor(logger: BaseLogger) {
        super(logger);
        this.selfBound();
    }

    get className() {
        return this.constructor.name;
    }

    private selfBound() {
        this.initSummary = this.initSummary.bind(this);
    }

    private async initSummary() {
        this.emit("HOURLY");
        this.emit("DAILY");
    }

    subscribe(publisher: Scheduler<SchedulerKeys>) {
        return super.subscribe(publisher, "SUMMARY_TIME", this.initSummary);
    }

    unsubscribe(publisher: Scheduler<SchedulerKeys>) {
        return super.unsubscribe(publisher, "SUMMARY_TIME", this.initSummary);
    }
}
