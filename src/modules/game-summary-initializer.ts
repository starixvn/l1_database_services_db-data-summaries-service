import { Scheduler } from "@ldb/scheduler";
import { TypedEventEmitter } from "@ldb/types";
import { EJSON } from "bson";
import { Collection, MongoServerError } from "mongodb";
import { logger } from "../loggers";
import {
    CalculationConfig,
    FromBetSummaryConfig,
    FromBetSummaryConfigRaw,
    FromRoundSummaryConfig,
    FromRoundSummaryConfigRaw,
    SummaryConfig,
    SummaryConfigRaw,
} from "../types/summary-config";

export const INIT_EVENT_NAMES = {
    BET: "BET",
    ROUND: "ROUND",
} as const;

export type InitializerEventNames = (typeof INIT_EVENT_NAMES)[keyof typeof INIT_EVENT_NAMES];

type InitializerEvents = {
    [INIT_EVENT_NAMES.BET]: (...args: [FromBetSummaryConfig]) => Promise<void>;
    [INIT_EVENT_NAMES.ROUND]: (...args: [FromRoundSummaryConfig]) => Promise<void>;
};

export class GameSummaryInitializer extends TypedEventEmitter<InitializerEvents> {
    private readonly schedulers: Set<Scheduler> = new Set();

    constructor(protected readonly summaryConfigCollection: Collection<SummaryConfigRaw>) {
        super();
        this.summaryConfigCollection = summaryConfigCollection;

        this.selfBound();
    }

    protected get className(): string {
        return this.constructor.name;
    }

    protected selfBound() {
        this.execute = this.execute.bind(this);
    }

    protected static isGameSummaryConfig(summaryConfig: SummaryConfigRaw): summaryConfig is FromBetSummaryConfigRaw {
        const { category, type } = summaryConfig;
        return category === "games" && type === 0;
    }
    protected static isSlotSummaryConfig(summaryConfig: SummaryConfigRaw): summaryConfig is FromRoundSummaryConfigRaw {
        const { category, type } = summaryConfig;
        return category === "games" && type === 2;
    }

    protected static parseRawSummaryConfig(gameSummaryConfigRaw: FromBetSummaryConfigRaw): FromBetSummaryConfig;
    protected static parseRawSummaryConfig(slotSummaryConfigRaw: FromRoundSummaryConfigRaw): FromRoundSummaryConfig;
    protected static parseRawSummaryConfig(summaryConfigRaw: SummaryConfigRaw): SummaryConfig {
        const {
            calc: { stake, payout, refund },
            ...summaryConfig
        } = summaryConfigRaw;

        const calcConfig: CalculationConfig = {
            stake: EJSON.parse(stake),
            payout: EJSON.parse(payout),
            refund: EJSON.parse(refund),
        };

        return { ...summaryConfig, calc: calcConfig };
    }

    protected async execute() {
        try {
            const summaryConfigCursor = this.summaryConfigCollection.find({}, { projection: { _id: 0 } });

            for await (const summaryConfigRaw of summaryConfigCursor) {
                if (GameSummaryInitializer.isGameSummaryConfig(summaryConfigRaw)) {
                    const summaryConfig = GameSummaryInitializer.parseRawSummaryConfig(summaryConfigRaw);
                    this.emit(INIT_EVENT_NAMES.BET, summaryConfig);
                    continue;
                }
                if (GameSummaryInitializer.isSlotSummaryConfig(summaryConfigRaw)) {
                    const summaryConfig = GameSummaryInitializer.parseRawSummaryConfig(summaryConfigRaw);
                    this.emit(INIT_EVENT_NAMES.ROUND, summaryConfig);
                    continue;
                }
            }
        } catch (error: unknown) {
            this.handleExecuteError(error);
        }
    }

    protected handleExecuteError(error: unknown) {
        if (error instanceof MongoServerError) {
            logger.logError(`${this.className}.execute`, error);
            return;
        }

        throw error;
    }

    subscribe(scheduler: Scheduler, event: string): boolean {
        if (this.schedulers.has(scheduler)) {
            logger.logWarning(`${this.className}.subscribe`, "Already subscribed");
            return false;
        }

        this.schedulers.add(scheduler);
        scheduler.addListener(event, this.execute);
        return true;
    }

    unsubscribe(scheduler: Scheduler, event: string): boolean {
        if (!this.schedulers.has(scheduler)) {
            logger.logWarning(`${this.className}.unsubscribe`, "Currently unsubscribed");
            return false;
        }

        scheduler.addListener(event, this.execute);
        this.schedulers.delete(scheduler);
        return true;
    }
}
