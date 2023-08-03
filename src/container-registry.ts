import { Scheduler, SchedulerConfigs } from "@ldb/scheduler";
import { AwilixContainer, InjectionMode, ResolveOptions, asClass, asValue, createContainer } from "awilix";
import { ChangeStreamNameSpace, MongoClient } from "mongodb";
import { GameSummaryInitializer } from "./modules/game-summary-initializer";
import { Monitor } from "./monitor";
import { GameRoundSummarizer } from "./summarizers/game-round-summarizer";

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
            const { db, coll } = namespace;
            this.container.register({
                [name]: asValue(mongoClient.db(db).collection(coll)),
            });
        }

        return this;
    }

    private registerClasses() {
        this.container.register({
            gameSummaryInitializer: asClass(GameSummaryInitializer).singleton(),
            gameRoundSummarizer: asClass(GameRoundSummarizer).singleton(),
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
