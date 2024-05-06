import { Logger } from "@ldb/logger";
import type { MongoClient } from "@ldb/mongo";
import { Scheduler } from "@ldb/scheduler";
import { SentryLogger } from "@ldb/sentry-logger";
import { SkynexLogger } from "@ldb/skynex-logger";
import { TerminalLogger } from "@ldb/terminal-logger";
import { asClass, asValue, createContainer, InjectionMode, type AwilixContainer, type ResolveOptions } from "awilix";
import {
    environment,
    eventConfigs,
    healthcheckPort,
    sentryNodeOptions,
    sentryOptions,
    sentrySeverityLevel,
    skynexOptions,
    skynexSeverityLevel,
    terminalSeverityLevel,
} from "./app-configs.js";
import { App } from "./app.js";
import { DailyStatement, DailySummarizer, HourlyStatement, HourlySummarizer, RoundExtractor, TimeSummarizers } from "./extractors/index.js";
import { HealthcheckServer } from "./healthcheck/server.js";
import { SummaryInitiator, TimeInitiator } from "./initiators/index.js";
import { namespaces } from "./namespaces.js";
import { RoundTransformer, TicketTransformer } from "./transformers/index.js";

export class Container {
    private readonly container: AwilixContainer;

    constructor() {
        this.container = createContainer({ injectionMode: InjectionMode.CLASSIC });
    }

    register() {
        this.registerLoggers().registerScheduler().registerClasses().registerHealthcheck();
        return this;
    }

    private registerLoggers() {
        this.container.register({
            terminalLogger: asClass(TerminalLogger).singleton(),
            terminalSeverityLevel: asValue(terminalSeverityLevel),
        });
        this.container.register({
            skynexLogger: asClass(SkynexLogger).singleton(),
            skynexOptions: asValue(skynexOptions),
            skynexSeverityLevel: asValue(skynexSeverityLevel),
        });
        this.container.register({
            sentryLogger: asClass(SentryLogger).singleton(),
            sentryNodeOptions: asValue(sentryNodeOptions),
            sentryOptions: asValue(sentryOptions),
            sentrySeverityLevel: asValue(sentrySeverityLevel),
        });
        this.container.register({
            logger: asClass(Logger).singleton(),
            otherLoggers: asValue(null),
            environment: asValue(environment),
        });
        return this;
    }

    private registerScheduler() {
        this.container.register({
            scheduler: asClass(Scheduler).singleton(),
            eventConfigs: asValue(eventConfigs),
        });
        return this;
    }

    private registerClasses() {
        this.container.register({
            app: asClass(App).singleton(),
            summaryInitiator: asClass(SummaryInitiator).singleton(),
            timeInitiator: asClass(TimeInitiator).singleton(),
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

    private registerHealthcheck() {
        this.container.register({
            healthcheckServer: asClass(HealthcheckServer).singleton(),
            healthcheckPort: asValue(healthcheckPort),
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

    resolve<N extends string>(name: N, resolveOptions?: ResolveOptions) {
        return this.container.resolve(name, resolveOptions);
    }
}
