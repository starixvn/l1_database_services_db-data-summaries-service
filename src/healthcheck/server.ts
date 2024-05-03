import type { BaseLogger } from "@ldb/base-logger";
import http, { type IncomingMessage, type Server, type ServerResponse } from "http";
import { name, version } from "../metadata.js";

export class HealthcheckServer {
    private readonly server: Server;

    get className() {
        return this.constructor.name;
    }

    constructor(private readonly healthcheckPort: number, private readonly logger: BaseLogger) {
        this.selfBound();

        this.server = http.createServer();
        this.server.listen(this.healthcheckPort);
        this.server.on("listening", this.handleListening);
        this.server.on("request", this.handleRequest);
    }

    private selfBound() {
        this.handleListening = this.handleListening.bind(this);
        this.handleRequest = this.handleRequest.bind(this);
    }

    private handleListening() {
        this.logger.logInfo({ title: this.className, message: `Healthcheck server started on port ${this.healthcheckPort}` });
    }

    private handleRequest(req: IncomingMessage, res: ServerResponse) {
        res.end(`${name}@${version}`);
    }
}
