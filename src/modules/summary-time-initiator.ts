import { Scheduler } from "@ldb/scheduler";
import { MaybePromise, TypedEventEmitter } from "@ldb/types";
import { logger } from "../loggers";

export type SummaryTimeInitiatorEvents = {
    HOURLY: (...args: []) => MaybePromise<void>;
    DAILY: (...args: []) => MaybePromise<void>;
};

export class SummaryTimeInitiator extends TypedEventEmitter<SummaryTimeInitiatorEvents> {
    private readonly schedulers: Set<Scheduler> = new Set();

    constructor() {
        super();
        this.selfBound();
    }

    get className() {
        return this.constructor.name;
    }

    private selfBound() {
        this.initialSummary = this.initialSummary.bind(this);
    }

    private async initialSummary() {
        this.emit("HOURLY");
        this.emit("DAILY");
    }

    subscribe(scheduler: Scheduler): boolean {
        if (this.schedulers.has(scheduler)) {
            logger.logWarning(`${this.className}.subscribe`, "Already subscribed");
            return false;
        }

        this.schedulers.add(scheduler);
        scheduler.addListener("SUMMARY_TIME", this.initialSummary);
        return true;
    }

    unsubscribe(scheduler: Scheduler): boolean {
        if (!this.schedulers.has(scheduler)) {
            logger.logWarning(`${this.className}.unsubscribe`, "Currently unsubscribed");
            return false;
        }

        scheduler.removeListener("SUMMARY_TIME", this.initialSummary);
        this.schedulers.delete(scheduler);
        return true;
    }
}
