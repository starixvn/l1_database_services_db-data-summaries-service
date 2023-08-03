import { Scheduler } from "@ldb/scheduler";
import { waitMs } from "@ldb/utils";
import { logger, terminal } from "./loggers";
import { GameSummaryInitializer } from "./modules/game-summary-initializer";
import { GameRoundSummarizer } from "./summarizers/game-round-summarizer";

export class Monitor {
    constructor(
        private readonly nodeEnv: string,
        private readonly scheduler: Scheduler,
        private readonly gameSummaryInitializer: GameSummaryInitializer,
        private readonly gameRoundSummarizer: GameRoundSummarizer
    ) {
        this.nodeEnv = nodeEnv;
        this.scheduler = scheduler;
        this.gameSummaryInitializer = gameSummaryInitializer;
        this.gameRoundSummarizer = gameRoundSummarizer;

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
        this.gameSummaryInitializer.subscribe(this.scheduler, "roundSummary");
        this.gameRoundSummarizer.subscribe(this.gameSummaryInitializer);

        this.scheduler.on("roundSummary", console.log.bind({}, new Date().toISOString(), "roundSummary"));
        this.gameSummaryInitializer.on("ROUND", console.log.bind({}, new Date().toISOString(), "ROUND"));

        if (this.nodeEnv === "DEVELOPMENT") {
            this.scheduler.emit("roundSummary");
        }
        terminal.logInfo("The monitor has run!");
    }
}
