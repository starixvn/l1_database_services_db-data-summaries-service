import { MongoClient, MONGOCLIENT_DEFAULT_OPTIONS } from "@ldb/mongo";
import { database } from "./app-configs.js";
import type { App } from "./app.js";
import { Container } from "./container.js";

const init = async () => {
    const { mongoURI } = database;
    const targetMongo = new MongoClient(mongoURI, MONGOCLIENT_DEFAULT_OPTIONS);

    const container = new Container().register().registerDatabases(targetMongo);
    const app: App = container.resolve("app");
    container.resolve("healthcheckServer");

    app.initiate();
};
init();
