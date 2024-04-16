import http, { IncomingMessage, Server, ServerResponse } from "http";
import { RequestOptions } from "https";

export class HealthCheckServer {
    readonly server: Server;

    static requestHealthCheck(options: RequestOptions) {
        const httpRequest = http.request(options, HealthCheckServer.handleHealthCheckResponse);

        httpRequest.on("error", HealthCheckServer.handleHealthCheckError);

        httpRequest.end();
    }

    private static handleHealthCheckResponse(res: IncomingMessage) {
        const { statusCode } = res;

        process.exitCode = statusCode === 200 ? 0 : 1;
        process.exit();
    }
    private static handleHealthCheckError(error: Error) {
        process.exit(1);
    }

    constructor(private readonly port: number) {
        this.selfBound();

        this.server = http.createServer();
        this.server.listen(this.port);
        this.server.on("listening", this.handleListening);
        this.server.on("request", this.handleRequest);
    }

    private selfBound() {
        this.handleListening = this.handleListening.bind(this);
        this.handleRequest = this.handleRequest.bind(this);
    }

    private handleListening() {}

    private handleRequest(req: IncomingMessage, res: ServerResponse) {
        res.end("Data Summaries");
    }
}
