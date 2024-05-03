import type { BaseLogger } from "@ldb/base-logger";
import { Dispatcher } from "../modules/dispatcher.js";
import type { Scheduler, SchedulerEvents } from "../types/scheduler.js";

export type TimeInitiatorEvents = Record<"HOURLY" | "DAILY", () => Promise<void>>;

export class TimeInitiator extends Dispatcher<TimeInitiatorEvents, "SUMMARY_TIME", Pick<SchedulerEvents, "SUMMARY_TIME">, Scheduler> {
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

    subscribe(publisher: Scheduler) {
        return super.subscribe(publisher, "SUMMARY_TIME", this.initSummary);
    }

    unsubscribe(publisher: Scheduler) {
        return super.unsubscribe(publisher, "SUMMARY_TIME", this.initSummary);
    }
}
