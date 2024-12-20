import type { BaseLogger } from "@ldb/logger";
import type { ChangeStreamNameSpace, CollectionAggregationPipeline, MongoClient } from "@ldb/mongo";
import { Scheduler } from "@ldb/scheduler";
import { Dispatcher } from "@ldb/utils";
import { AGGREGATE_OPTIONS } from "../consts/aggregation.js";
import { BATCH_LIMIT, BATCH_TERMINATE_THRESHOLD, DO_FLAG, DONE_FLAG } from "../consts/summary-constants.js";
import type { OperatorRawSummarySchema, OperatorSummarySchema } from "../types/oprerator-summary-schema.js";
import type { SchedulerEvents, SchedulerKeys } from "../types/scheduler.js";

export type OperatorTransformerEvents = {
    OPERATOR_TRANSFORMED: () => void;
};

export class OperatorSummariesTransformer extends Dispatcher<OperatorTransformerEvents, SchedulerEvents> {
    constructor(
        private readonly mongo: MongoClient,
        private readonly operatorRawSummariesNamespace: ChangeStreamNameSpace,
        private readonly operatorDailySummariesNamespace: ChangeStreamNameSpace,
        logger: BaseLogger,
    ) {
        super(logger);
        this.selfBound();
    }

    private get operatorRawSummariesCollection() {
        const { db, coll } = this.operatorRawSummariesNamespace;
        return this.mongo.db(db).collection<OperatorRawSummarySchema>(coll);
    }

    private get operatorDailySummariesCollection() {
        const { db, coll } = this.operatorDailySummariesNamespace;
        return this.mongo.db(db).collection<OperatorSummarySchema>(coll);
    }

    private selfBound() {
        this.execute = this.execute.bind(this);
    }

    private async execute() {
        const pipeline = this.getPipeline();

        let lastCount = 0;
        do {
            await this.setDoFlag();
            await this.operatorRawSummariesCollection.aggregate(pipeline, AGGREGATE_OPTIONS).toArray();
            lastCount = await this.setDoneFlag();
        } while (lastCount >= BATCH_LIMIT * BATCH_TERMINATE_THRESHOLD);
    }

    private getPipeline() {
        return [
            { $match: { [DO_FLAG]: true } },
            {
                $project: {
                    _id: "$_id",
                    operatorId: "$operatorId",
                    time: { $dateFromString: { dateString: "$targetDate", format: "%Y/%m/%d", timezone: "+00" } },
                    siteId: "$siteId",
                    currency: "$currencyIso",
                    stake: { $toDouble: "$actualStake" },
                    tickets: { $toInt: "$betCount" },
                    winloss: { $toDouble: "$winLose" },
                },
            },
            {
                $merge: {
                    into: this.operatorDailySummariesNamespace,
                    on: "_id",
                    whenMatched: "replace",
                    whenNotMatched: "insert",
                },
            },
        ] as const satisfies CollectionAggregationPipeline;
    }

    private async setDoFlag() {
        await this.operatorRawSummariesCollection
            .aggregate([
                { $match: { $or: [{ [DONE_FLAG]: false }, { [DONE_FLAG]: null }] } },
                { $limit: BATCH_LIMIT },
                { $project: { _id: 1, __archive: 1 } },
                { $set: { [DO_FLAG]: true } },
                { $merge: { into: this.operatorRawSummariesCollection.collectionName } },
            ])
            .toArray();
    }
    private async setDoneFlag() {
        const { matchedCount, modifiedCount } = await this.operatorRawSummariesCollection.updateMany(
            { [DO_FLAG]: true }, //
            { $set: { [DONE_FLAG]: true }, $unset: { [DO_FLAG]: 1 } },
        );

        this.logger.logDebug({ title: `${this.className}+${DONE_FLAG}`, message: `#=${matchedCount}  M=${modifiedCount}` });
        return modifiedCount;
    }

    subscribe(publisher: Scheduler<SchedulerKeys>) {
        return super.subscribe(publisher, "SUMMARY_OPERATOR", this.execute);
    }

    unsubscribe(publisher: Scheduler<SchedulerKeys>) {
        return super.unsubscribe(publisher, "SUMMARY_OPERATOR", this.execute);
    }
}
