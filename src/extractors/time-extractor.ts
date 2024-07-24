import type { BaseLogger } from "@ldb/base-logger";
import type { ChangeStreamNameSpace, Document, MongoClient } from "@ldb/mongo";
import { AGGREGATE_OPTIONS } from "../consts/aggregation.js";
import type { TimeInitiator, TimeInitiatorEvents } from "../initiators/time-initiator.js";
import { Subscriber } from "../modules/subscriber.js";

export type TimePipelineFactory = (sourceNamespace: ChangeStreamNameSpace, targetNamespace: ChangeStreamNameSpace) => Document[];
export type TimeExtractorConfig<Event extends keyof TimeInitiatorEvents> = { type: Lowercase<Event> };

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
        const pipeline = this.pipelineFactory(this.sourceNamespace, this.targetNamespace);

        await this.markFlag();
        await this.sourceCollection.aggregate(pipeline, AGGREGATE_OPTIONS).tryNext();
        await this.updateFlag();
    }

    private async markFlag() {
        const { type } = this.config;
        const flag = `__archive.${type}` as const;
        const doFlag = `__archive.do_${type}` as const;

        const { matchedCount, upsertedCount, modifiedCount } = await this.sourceCollection.updateMany({ $or: [{ [flag]: false }, { [flag]: null }] }, { $set: { [doFlag]: true } });

        this.logger.logDebug({
            title: `${this.className}.markFlag - ${type}`,
            message: `#-${matchedCount}  I-${upsertedCount}  M-${modifiedCount}    (${this.sourceCollection.namespace})`,
        });
    }

    protected async updateFlag() {
        const { type } = this.config;
        const flag = `__archive.${type}` as const;
        const doFlag = `__archive.do_${type}` as const;

        const { matchedCount, upsertedCount, modifiedCount } = await this.sourceCollection.updateMany({ [doFlag]: true }, [{ $set: { [doFlag]: "$$REMOVE", [flag]: true } }]);

        this.logger.logDebug({
            title: `${this.className}.updateFlag - ${type}`,
            message: `#-${matchedCount}  I-${upsertedCount}  M-${modifiedCount}    (${this.sourceCollection.namespace})`,
        });
    }

    subscribe(publisher: TimeInitiator, event: Event) {
        return super.subscribe(publisher, event, this.execute);
    }

    unsubscribe(publisher: TimeInitiator, event: Event) {
        return super.unsubscribe(publisher, event, this.execute);
    }
}
