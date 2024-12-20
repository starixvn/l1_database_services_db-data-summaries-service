import { asClass, asValue, BaseContainer } from "@ldb/base-container";
import type { MongoClient } from "@ldb/mongo";
import { healthcheckPort, lumiLoggerConfig, schedulerConfig } from "./app-configs.js";
import { App } from "./app.js";
import { DailyStatement, DailySummarizer, HourlyStatement, HourlySummarizer, RoundExtractor, TimeSummarizers } from "./extractors/index.js";
import { SummaryInitiator, TimeInitiator } from "./initiators/index.js";
import { metadata } from "./metadata.js";
import { namespaces } from "./namespaces.js";
import { RoundTransformer, TicketTransformer } from "./transformers/index.js";
import { OperatorSummariesTransformer } from "./transformers/operator-summaries-transfromer.js";

export class Container extends BaseContainer {
    constructor() {
        super();
    }

    register() {
        this.registerLogger(lumiLoggerConfig).registerHealthcheck(metadata, healthcheckPort).registerScheduler(schedulerConfig).registerClasses();
        return this;
    }

    private registerClasses() {
        this.container.register({
            app: asClass(App).singleton(),
            summaryInitiator: asClass(SummaryInitiator).singleton(),
            timeInitiator: asClass(TimeInitiator).singleton(),
            operatorSummariesTransformer: asClass(OperatorSummariesTransformer).singleton(),
            roundTransformer: asClass(RoundTransformer).singleton(),
            ticketTransformer: asClass(TicketTransformer).singleton(),
            roundExtractor: asClass(RoundExtractor).singleton(),
            dailySummarizer: asClass(DailySummarizer).singleton(),
            hourlySummarizer: asClass(HourlySummarizer).singleton(),
            dailyStatement: asClass(DailyStatement).singleton(),
            hourlyStatement: asClass(HourlyStatement).singleton(),
            timeSummarizers: asClass(TimeSummarizers).singleton(),
        });
        return this;
    }

    registerDatabases(mongo: MongoClient) {
        this.container.register({
            mongo: asValue(mongo),
        });

        for (const [name, value] of Object.entries(namespaces)) {
            this.container.register({
                [name]: asValue(value),
            });
        }

        return this;
    }
}
