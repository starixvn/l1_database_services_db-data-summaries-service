import { Scheduler, SchedulerConfigs } from "@ldb/scheduler";
import { AwilixContainer, InjectionMode, ResolveOptions, asClass, asValue, createContainer } from "awilix";
import { ChangeStreamNameSpace, MongoClient } from "mongodb";
import { SummaryRoundInitiator } from "./modules/summary-round-initiator";
import { SummaryTimeInitiator } from "./modules/summary-time-initiator";
import { Monitor } from "./monitor";
import { DailySummarizer } from "./summarizers/daily-summarizer";
import { GameRoundSummarizer } from "./summarizers/game-round-summarizer";
import { HourlySummarizer } from "./summarizers/hourly-summarizer";
import { getCollection } from "./utils/mongodb-utils";

export class ContainerRegistry {
    private readonly container: AwilixContainer;

    constructor(defaultInjectionMode: typeof InjectionMode.CLASSIC = InjectionMode.CLASSIC) {
        this.container = createContainer({ injectionMode: defaultInjectionMode });
    }

    register(mongoClient: MongoClient) {
        this.container.register({
            mongoClient: asValue(mongoClient),
        });

        this.registerClasses();
        this.registerEnv();

        return this;
    }

    registerScheduler(eventConfigs: SchedulerConfigs) {
        this.container.register({
            scheduler: asClass(Scheduler).singleton(),
            eventConfigs: asValue(eventConfigs),
        });

        return this;
    }

    registerNamespaces(namespaces: Record<string, ChangeStreamNameSpace>): this {
        const mongoClient: MongoClient = this.container.resolve("mongoClient");

        for (const [name, namespace] of Object.entries(namespaces)) {
            this.container.register({
                [`${name}Namespace`]: asValue(namespace),
                [`${name}Collection`]: asValue(getCollection(mongoClient, namespace)),
            });
        }

        return this;
    }

    private registerClasses() {
        this.container.register({
            summaryRoundInitiator: asClass(SummaryRoundInitiator).singleton(),
            gameRoundSummarizer: asClass(GameRoundSummarizer).singleton(),
            summaryTimeInitiator: asClass(SummaryTimeInitiator).singleton(),
            hourlySummarizer: asClass(HourlySummarizer).singleton(),
            dailySummarizer: asClass(DailySummarizer).singleton(),
            monitor: asClass(Monitor).singleton(),
        });

        return this;
    }

    private registerEnv() {
        const { NODE_ENV: nodeEnv } = process.env;

        this.container.register({
            nodeEnv: asValue(nodeEnv || "DEVELOPMENT"),
        });

        return this;
    }

    resolve(name: string, resolveOptions?: ResolveOptions) {
        return this.container.resolve(name, resolveOptions);
    }
}
