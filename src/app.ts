import { BaseApp } from "@ldb/base-app";
import type { BaseLogger } from "@ldb/logger";
import type { Scheduler } from "@ldb/scheduler";
import type { Metadata } from "@ldb/utils";
import type { RoundExtractor, TimeSummarizers } from "./extractors/index.js";
import type { SummaryInitiator, TimeInitiator } from "./initiators/index.js";
import type { RoundTransformer, TicketTransformer } from "./transformers/index.js";
import type { OperatorSummariesTransformer } from "./transformers/operator-summaries-transfromer.js";
import type { SchedulerKeys } from "./types/scheduler.js";

export class App extends BaseApp {
    constructor(
        private readonly scheduler: Scheduler<SchedulerKeys>,
        private readonly summaryInitiator: SummaryInitiator,
        private readonly timeInitiator: TimeInitiator,
        private readonly operatorSummariesTransformer: OperatorSummariesTransformer,
        private readonly roundTransformer: RoundTransformer,
        private readonly ticketTransformer: TicketTransformer,
        private readonly roundExtractor: RoundExtractor,
        private readonly timeSummarizers: TimeSummarizers,

        metadata: Metadata,
        logger: BaseLogger,
    ) {
        super(metadata, logger);
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

        this.operatorSummariesTransformer.subscribe(this.scheduler);

        super.initiate();
    }

    terminate() {
        this.operatorSummariesTransformer.unsubscribe(this.scheduler);

        this.timeInitiator.unsubscribe(this.scheduler);

        this.timeSummarizers.dailySummarizer.unsubscribe(this.timeInitiator);
        this.timeSummarizers.hourlySummarizer.unsubscribe(this.timeInitiator);
        this.timeSummarizers.dailyStatement.unsubscribe(this.timeInitiator);
        this.timeSummarizers.hourlyStatement.unsubscribe(this.timeInitiator);

        this.summaryInitiator.unsubscribe(this.scheduler);

        this.ticketTransformer.unsubscribe(this.summaryInitiator);
        this.roundTransformer.unsubscribe(this.summaryInitiator);

        this.roundExtractor.unsubscribe(this.ticketTransformer);
        this.roundExtractor.unsubscribe(this.roundTransformer);

        super.terminate();
    }
}
