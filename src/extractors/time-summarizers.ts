import type { DailyStatement } from "./daily-statement.js";
import type { DailySummarizer } from "./daily-summarizer.js";
import type { HourlyStatement } from "./hourly-statement.js";
import type { HourlySummarizer } from "./hourly-summarizer.js";

export class TimeSummarizers {
    constructor(
        public readonly dailySummarizer: DailySummarizer,
        public readonly hourlySummarizer: HourlySummarizer,
        public readonly dailyStatement: DailyStatement,
        public readonly hourlyStatement: HourlyStatement
    ) {}
}
