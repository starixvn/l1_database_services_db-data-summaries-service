import type { BaseLogger } from "@ldb/base-logger";
import type { Scheduler } from "@ldb/scheduler";
import type { RoundExtractor, TimeSummarizers } from "./extractors/index.js";
import type { SummaryInitiator, TimeInitiator } from "./initiators/index.js";
import { name, version } from "./metadata.js";
import type { RoundTransformer, TicketTransformer } from "./transformers/index.js";

let exiting = false;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class App {
    constructor(
        private readonly scheduler: Scheduler,
        private readonly summaryInitiator: SummaryInitiator,
        private readonly timeInitiator: TimeInitiator,
        private readonly roundTransformer: RoundTransformer,
        private readonly ticketTransformer: TicketTransformer,
        private readonly roundExtractor: RoundExtractor,
        private readonly timeSummarizers: TimeSummarizers,

        private readonly logger: BaseLogger,
    ) {
        this.selfBound();
        this.handleExceptions();
    }

    get className() {
        return this.constructor.name;
    }

    private selfBound() {
        this.handleUncaughtException = this.handleUncaughtException.bind(this);
        this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
    }

    private handleExceptions() {
        process.addListener("uncaughtException", this.handleUncaughtException);
        process.addListener("unhandledRejection", this.handleUnhandledRejection);
    }

    private async handleUncaughtException(error: Error, origin: NodeJS.UncaughtExceptionOrigin) {
        while (exiting) {
            await wait(1_000);
        }

        exiting = true;
        this.logger.logFatal({ title: name, message: error }, { tags: { event: "uncaughtException" }, extra: { error, origin } });

        await wait(5_000);
        process.exit(10);
    }

    private async handleUnhandledRejection(reason: unknown, promise: Promise<unknown>) {
        while (exiting) {
            await wait(5_000);
        }

        exiting = true;
        this.logger.logFatal({ title: name, message: reason }, { tags: { event: "unhandledRejection" }, extra: { reason, promise } });

        await wait(5_000);
        process.exit(20);
    }

    initiate() {
        this.roundExtractor.subscribe(this.ticketTransformer);
        this.roundExtractor.subscribe(this.roundTransformer);

        this.ticketTransformer.subscribe(this.summaryInitiator);
        this.roundTransformer.subscribe(this.summaryInitiator);

        this.summaryInitiator.subscribe(this.scheduler);

        this.timeSummarizers.dailySummarizer.subscribe(this.timeInitiator);
        this.timeSummarizers.hourlySummarizer.subscribe(this.timeInitiator);
        this.timeSummarizers.dailyStatement.subscribe(this.timeInitiator);
        this.timeSummarizers.hourlyStatement.subscribe(this.timeInitiator);

        this.timeInitiator.subscribe(this.scheduler);

        this.logger.logWarning({ title: `${name}@${version}`, message: "App has been started." });
    }
}
