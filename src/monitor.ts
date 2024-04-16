import { Scheduler } from "@ldb/scheduler";
import { stringify, waitMs } from "@ldb/utils";
import { logger } from "./loggers";
import { SummaryRoundInitiator } from "./modules/summary-round-initiator";
import { SummaryTimeInitiator } from "./modules/summary-time-initiator";
import { DailySummarizer } from "./summarizers/daily-summarizer";
import { HourlySummarizer } from "./summarizers/hourly-summarizer";
import { RoundTransformer } from "./transformers/round-transformer";
import { TicketTransformer } from "./transformers/ticket-transformer";

export class Monitor {
    constructor(
        private readonly nodeEnv: string,
        private readonly scheduler: Scheduler,
        private readonly summaryRoundInitiator: SummaryRoundInitiator,
        private readonly roundTransformer: RoundTransformer,
        private readonly ticketTransformer: TicketTransformer,
        private readonly summaryTimeInitiator: SummaryTimeInitiator,
        private readonly hourlySummarizer: HourlySummarizer,
        private readonly dailySummarizer: DailySummarizer
    ) {
        this.selfBound();
        this.reportUnhandleErrors();
    }

    private selfBound() {
        this.handleUncaughtException = this.handleUncaughtException.bind(this);
        this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
    }

    private reportUnhandleErrors() {
        process.addListener("uncaughtException", this.handleUncaughtException);
        process.addListener("unhandledRejection", this.handleUnhandledRejection);
    }
    private async handleUncaughtException(error: Error, origin: NodeJS.UncaughtExceptionOrigin) {
        logger.logError(origin, error);

        await waitMs(5000);
        process.exit(10);
    }
    private async handleUnhandledRejection(reason: unknown, promise: Promise<unknown>) {
        logger.logError("unhandledRejection", reason, { promise });

        await waitMs(5000);
        process.exit(20);
    }

    async run() {
        this.summaryRoundInitiator.subscribe(this.scheduler);
        this.roundTransformer.subscribe(this.summaryRoundInitiator);
        this.ticketTransformer.subscribe(this.summaryRoundInitiator);

        this.summaryTimeInitiator.subscribe(this.scheduler);
        this.hourlySummarizer.subscribe(this.summaryTimeInitiator);
        this.dailySummarizer.subscribe(this.summaryTimeInitiator);

        if (this.nodeEnv === "DEVELOPMENT") {
            await this.devMode();
        }

        this.scheduler.emit("SUMMARY_ROUND");
        this.scheduler.emit("SUMMARY_TIME");

        console.log(new Date().toISOString(), "The monitor has run!");
    }

    private async devMode() {
        this.scheduler.on("SUMMARY_ROUND", this.devEventLogger.bind(this, this.scheduler.constructor.name, "SUMMARY_ROUND"));
        this.scheduler.on("SUMMARY_TIME", this.devEventLogger.bind(this, this.scheduler.constructor.name, "SUMMARY_TIME"));
    }
    private devEventLogger(title: string, subject: string, ...args: unknown[]) {
        console.log(new Date().toISOString(), stringify(args), { title, subject });
    }
}
