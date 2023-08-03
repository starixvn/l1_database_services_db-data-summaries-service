import { MongoClient } from "mongodb";
import { database, eventConfigs, hostingPort } from "./app-configs";
import { ContainerRegistry } from "./container-registry";
import { HealthCheckServer } from "./healthcheck-server";
import { logger } from "./loggers";
import { Monitor } from "./monitor";
import { namespaces } from "./namespaces";
import { SERVICE_VERSION } from "./service-version";

(async () => {
    const server = new HealthCheckServer(hostingPort);
    if (!server.server.listening) {
        logger.logError("HealthCheckServer", "HealthCheckServer is unhealthy", { hostingPort });
    }

    const mongoClient = new MongoClient(database.url);
    const container = new ContainerRegistry().register(mongoClient).registerScheduler(eventConfigs).registerNamespaces(namespaces);

    const monitor: Monitor = container.resolve("monitor");
    monitor.run();

    logger.logInfo("", `Data Summaries Service v${SERVICE_VERSION} has been started!`, false);
})();
