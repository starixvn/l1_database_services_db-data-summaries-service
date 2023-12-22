import { Scheduler } from "@ldb/scheduler";
import { MaybePromise, TypedEventEmitter } from "@ldb/types";
import { stringify } from "@ldb/utils";
import { Collection } from "mongodb";
import { logger } from "../loggers";
import { BetSummaryConfig, RoundSummaryConfig, SchemaSummaryConfig } from "../types/summary-config";
import { parseSummaryConfig } from "../utils/type-conversions";
import { isBetSummaryConfig, isRoundSummaryConfig } from "../utils/type-guards";

export type SummaryRoundInitiatorEvents = {
    BET: (...args: [BetSummaryConfig]) => MaybePromise<void>;
    ROUND: (...args: [RoundSummaryConfig]) => MaybePromise<void>;
};

export class SummaryRoundInitiator extends TypedEventEmitter<SummaryRoundInitiatorEvents> {
    private readonly schedulers: Set<Scheduler> = new Set();

    constructor(protected readonly summaryConfigCollection: Collection<SchemaSummaryConfig>) {
        super();
        this.selfBound();
    }

    get className() {
        return this.constructor.name;
    }

    private selfBound() {
        this.initialSummaryRound = this.initialSummaryRound.bind(this);
    }

    private async initialSummaryRound() {
        const summaryConfigCursor = this.summaryConfigCollection.find({}, { projection: { _id: 0 } });

        for await (const summaryConfigRaw of summaryConfigCursor) {
            const summaryConfig = parseSummaryConfig(summaryConfigRaw);

            if (isBetSummaryConfig(summaryConfig)) {
                this.emit("BET", summaryConfig);
                continue;
            }
            if (isRoundSummaryConfig(summaryConfig)) {
                this.emit("ROUND", summaryConfig);
                continue;
            }

            throw new TypeError(`Incorrect summary config ${stringify(summaryConfig)}`);
        }
    }

    subscribe(scheduler: Scheduler): boolean {
        if (this.schedulers.has(scheduler)) {
            logger.logWarning(`${this.className}.subscribe`, "Already subscribed");
            return false;
        }

        this.schedulers.add(scheduler);
        scheduler.addListener("SUMMARY_ROUND", this.initialSummaryRound);
        return true;
    }

    unsubscribe(scheduler: Scheduler): boolean {
        if (!this.schedulers.has(scheduler)) {
            logger.logWarning(`${this.className}.unsubscribe`, "Currently unsubscribed");
            return false;
        }

        scheduler.removeListener("SUMMARY_ROUND", this.initialSummaryRound);
        this.schedulers.delete(scheduler);
        return true;
    }
}
