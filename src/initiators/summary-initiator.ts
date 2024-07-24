import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, MongoClient } from "@ldb/mongo";
import { parseSummaryConfig } from "../helpers/summary-config.js";
import { Dispatcher } from "../modules/dispatcher.js";
import type { Scheduler, SchedulerEvents } from "../types/scheduler.js";
import type { SchemaSummaryConfig, SummaryConfig } from "../types/summary-config.js";

export type SummaryInitiatorEvents = Record<SummaryConfig["_brand"], (config: SummaryConfig) => Promise<void>> & Record<"gameId", (gameId: number) => Promise<void>>;

export class SummaryInitiator extends Dispatcher<SummaryInitiatorEvents, "SUMMARY_ROUND", Pick<SchedulerEvents, "SUMMARY_ROUND">, Scheduler> {
    constructor(private readonly mongo: MongoClient, private readonly summaryConfigsNamespace: ChangeStreamNameSpace, logger: BaseLogger) {
        super(logger);
        this.selfBound();
    }

    get className() {
        return this.constructor.name;
    }

    get summaryConfigsCollection() {
        const { db, coll } = this.summaryConfigsNamespace;
        return this.mongo.db(db).collection<SchemaSummaryConfig>(coll);
    }

    private selfBound() {
        this.initSummary = this.initSummary.bind(this);
    }

    private async initSummary() {
        const rawSummaryConfigCursor = this.getRawSummaryConfigs();

        for await (const rawSummaryConfig of rawSummaryConfigCursor) {
            this.emitSummaryConfig(rawSummaryConfig);
        }
    }

    private emitSummaryConfig(rawSummaryConfig: SchemaSummaryConfig) {
        try {
            const summaryConfig = parseSummaryConfig(rawSummaryConfig);
            const { _brand } = summaryConfig;
            this.emit(_brand, summaryConfig);

            const {
                gameConfigs: { gameId },
            } = summaryConfig;
            this.emit("gameId", gameId);
        } catch (error) {
            this.logger.logError({ title: this.className, message: error }, { extra: { rawSummaryConfig } });
        }
    }

    private getRawSummaryConfigs() {
        return this.summaryConfigsCollection.find({}, { projection: { _id: 0 } });
    }

    subscribe(publisher: Scheduler) {
        return super.subscribe(publisher, "SUMMARY_ROUND", this.initSummary);
    }

    unsubscribe(publisher: Scheduler) {
        return super.unsubscribe(publisher, "SUMMARY_ROUND", this.initSummary);
    }
}
