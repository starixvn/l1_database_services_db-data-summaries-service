import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { AGGREGATE_OPTIONS } from "../consts/aggregation.js";
import { BATCH_LIMIT, BATCH_TERMINATE_THRESHOLD, TIME_WARMING_PERIOD } from "../consts/summary-constants.js";
import type { TimeInitiator, TimeInitiatorEvents } from "../initiators/time-initiator.js";
import { Subscriber } from "../modules/subscriber.js";

export type TimePipelineFactory = (sourceNamespace: ChangeStreamNameSpace, targetNamespace: ChangeStreamNameSpace) => Document[];
export type TimeExtractorConfig<Event extends keyof TimeInitiatorEvents> = { type: Lowercase<Event> };

const getFlag = <S extends string>(type: S) => `__archive.${type}` as const;
const getDoFlag = <S extends string>(type: S) => `__archive.do_${type}` as const;

export class TimeExtractor<Event extends keyof TimeInitiatorEvents> extends Subscriber<Event, Pick<TimeInitiatorEvents, Event>, TimeInitiator> {
    private flag = false;
    private startTime = new Date();

    constructor(
        private readonly mongo: MongoClient,
        private readonly sourceNamespace: ChangeStreamNameSpace,
        private readonly targetNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: TimePipelineFactory,
        private readonly config: TimeExtractorConfig<Event>,
        logger: BaseLogger
    ) {
        super(logger);
        this.selfBound();
    }

    private get sourceCollection() {
        const { db, coll } = this.sourceNamespace;
        return this.mongo.db(db).collection(coll);
    }

    private selfBound() {
        this.execute = this.execute.bind(this);
    }

    private async execute() {
        if (this.flag) {
            this.logger.logInfo({ title: this.className, message: `Summary is running since ${this.startTime.toISOString()}` });
            return;
        }

        try {
            this.flag = true;
            this.startTime = new Date();
            await this.summarize();
        } catch (error) {
            this.logger.logError({ title: this.className, message: error });
        } finally {
            this.flag = false;
        }
    }

    private async summarize() {
        const doFlag = getDoFlag(this.config.type);
        const pipeline = this.pipelineFactory(this.sourceNamespace, this.targetNamespace);
        const matchStage = { $match: { [doFlag]: true } };

        let lastCount = 0;
        do {
            await this.setDoFlag();
            await this.sourceCollection.aggregate([matchStage, ...pipeline], AGGREGATE_OPTIONS).toArray();
            lastCount = await this.setDoneFlag();
        } while (lastCount >= BATCH_LIMIT * BATCH_TERMINATE_THRESHOLD);

        const matchWarmingStage = { $match: { time: { $gte: new Date(Date.now() - TIME_WARMING_PERIOD) } } };
        await this.sourceCollection.aggregate([matchWarmingStage, ...pipeline], AGGREGATE_OPTIONS).toArray();
    }

    private async setDoFlag() {
        const { type } = this.config;
        const flag = getFlag(type);
        const doFlag = getDoFlag(type);

        await this.sourceCollection
            .aggregate([
                { $match: { $or: [{ [flag]: false }, { [flag]: null }], time: { $lt: new Date(Date.now() - TIME_WARMING_PERIOD) } } },
                { $limit: BATCH_LIMIT },
                { $project: { _id: 1, __archive: 1 } },
                { $set: { [doFlag]: true } },
                { $merge: { into: this.sourceCollection.collectionName } },
            ])
            .toArray();
    }

    protected async setDoneFlag() {
        const { type } = this.config;
        const flag = getFlag(type);
        const doFlag = getDoFlag(type);

        const { matchedCount, upsertedCount, modifiedCount } = await this.sourceCollection.updateMany(
            { [doFlag]: true }, //
            [{ $set: { [doFlag]: "$$REMOVE", [flag]: true } }]
        );

        this.logger.logDebug({
            title: `${this.className}.updateFlag - ${type}`,
            message: `#-${matchedCount}  I-${upsertedCount}  M-${modifiedCount}    (${this.sourceCollection.namespace})`,
        });

        return modifiedCount + upsertedCount;
    }

    subscribe(publisher: TimeInitiator, event: Event) {
        return super.subscribe(publisher, event, this.execute);
    }

    unsubscribe(publisher: TimeInitiator, event: Event) {
        return super.unsubscribe(publisher, event, this.execute);
    }
}
