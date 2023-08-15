import { Scheduler } from "@ldb/scheduler";
import { stringify, waitMs } from "@ldb/utils";
import { logger, terminal } from "./loggers";
import { SummaryRoundInitiator } from "./modules/summary-round-initiator";
import { SummaryTimeInitiator } from "./modules/summary-time-initiator";
import { DailySummarizer } from "./summarizers/daily-summarizer";
import { GameBetSummarizer } from "./summarizers/game-bet-summarizer";
import { GameRoundSummarizer } from "./summarizers/game-round-summarizer";
import { HourlySummarizer } from "./summarizers/hourly-summarizer";

export class Monitor {
    constructor(
        private readonly nodeEnv: string,
        private readonly scheduler: Scheduler,
        private readonly summaryRoundInitiator: SummaryRoundInitiator,
        private readonly gameRoundSummarizer: GameRoundSummarizer,
        private readonly gameBetSummarizer: GameBetSummarizer,
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
        this.gameRoundSummarizer.subscribe(this.summaryRoundInitiator);
        this.gameBetSummarizer.subscribe(this.summaryRoundInitiator);

        this.summaryTimeInitiator.subscribe(this.scheduler);
        this.hourlySummarizer.subscribe(this.summaryTimeInitiator);
        this.dailySummarizer.subscribe(this.summaryTimeInitiator);

        if (this.nodeEnv === "DEVELOPMENT") {
            await this.devMode();
        }

        this.scheduler.emit("SUMMARY_ROUND");
        this.scheduler.emit("SUMMARY_TIME");

        terminal.logInfo("The monitor has run!");
    }

    private async devMode() {
        this.scheduler.on("SUMMARY_ROUND", this.devEventLogger.bind(this, this.scheduler.constructor.name, "SUMMARY_ROUND"));
        this.scheduler.on("SUMMARY_TIME", this.devEventLogger.bind(this, this.scheduler.constructor.name, "SUMMARY_TIME"));
    }
    private devEventLogger(title: string, subject: string, ...args: unknown[]) {
        terminal.logDebug(args.map((arg) => stringify(arg)).join("\n"), { title, subject });
    }
}
