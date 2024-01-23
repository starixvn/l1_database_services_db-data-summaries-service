import { MaybePromise } from "@ldb/types";
import { AggregateOptions, ChangeStreamNameSpace, Collection, Document, MongoClient, MongoServerError } from "mongodb";
import { inspect } from "util";
import { roundSummaryPipelineFactory } from "../consts/round-summary-pipeline";
import { DONE_FLAG, DO_FLAG } from "../consts/summaryFlags";
import { Subsciber } from "../modules/subscriber";
import { SummaryConfig } from "../types/summary-config";
import { getCollection } from "../utils/mongodb-utils";

type Events<SC extends SummaryConfig> = SC["_brand"];
type EventDescriptions<SC extends SummaryConfig> = Record<Events<SC>, (config: SC) => MaybePromise<void>>;
export type PipelineFactory<SC extends SummaryConfig> = (...args: [SC]) => Document[];

export class BaseTransformer<SC extends SummaryConfig> extends Subsciber<Events<SC>, EventDescriptions<SC>> {
    private readonly flags: Map<string, boolean> = new Map();

    constructor(
        private readonly mongoClient: MongoClient,
        private readonly ticketSummariesNamespace: ChangeStreamNameSpace,
        private readonly roundSummariesNamespace: ChangeStreamNameSpace,
        private readonly pipelineFactory: PipelineFactory<SC>
    ) {
        super();
        this.selfBound();
    }

    protected selfBound() {
        this.execute = this.execute.bind(this);
    }

    protected getPipeline(summaryConfig: SC) {
        return this.pipelineFactory(summaryConfig);
    }

    protected getColl(namespace: ChangeStreamNameSpace) {
        return getCollection(this.mongoClient, namespace);
    }

    protected getSourceCollection(summaryConfig: SummaryConfig) {
        const { _brand, coll } = summaryConfig;
        const namespace = _brand === "bet" ? coll.bet : coll.round;

        return this.getColl(namespace);
    }

    protected getRoundCollection(summaryConfig: SummaryConfig) {
        const {
            coll: { round },
        } = summaryConfig;

        return this.getColl(round);
    }

    protected getFlag(summaryConfig: SC) {
        const { gameConfigs } = summaryConfig;
        const { gameId, name } = gameConfigs;

        return `#${gameId}.${name}`;
    }

    protected async execute(summaryConfig: SC) {
        const flag = this.getFlag(summaryConfig);

        if (this.flags.get(flag)) {
            this.logger.logWarning(this.className, `Summary process [${flag}] is running!`);
            return;
        }

        try {
            this.flags.set(flag, true);
            await this.runTransform(summaryConfig);
            await this.runSummary(summaryConfig);
        } catch (error: unknown) {
            this.handleError(error, flag);
        } finally {
            this.flags.delete(flag);
        }
    }

    protected prepareTransformPipeline(summaryConfig: SC) {
        const pipeline = this.getPipeline(summaryConfig);

        const filterStage: Document = {
            $match: {
                gameId: { $ne: null },
                roundId: { $ne: null },
                operatorId: { $ne: null },
                playerId: { $ne: null },
            },
        };
        const mergeStage: Document = {
            $merge: {
                into: this.ticketSummariesNamespace,
                on: ["gameId", "roundId", "operatorId", "playerId"],
                whenMatched: "replace",
                whenNotMatched: "insert",
            },
        };

        pipeline.push(filterStage);
        pipeline.push(mergeStage);

        return pipeline;
    }

    protected async runTransform(summaryConfig: SC) {
        const aggregateOptions: AggregateOptions = { allowDiskUse: true };

        const sourceCollection = this.getSourceCollection(summaryConfig);
        const pipeline = this.prepareTransformPipeline(summaryConfig);

        await this.setDoSummaryFlag(sourceCollection);
        await sourceCollection.aggregate(pipeline, aggregateOptions).tryNext();

        const doneFilter = this.buildTransfromDoneFilter(summaryConfig);
        await this.removeDoSummaryFlag(sourceCollection, doneFilter);
    }

    protected async buildTransfromDoneFilter(summaryConfig: SC): Promise<Document> {
        const {
            _brand,
            aliases,
            calc: { roundId: roundCalc },
        } = summaryConfig;
        const time = aliases.time;
        const settled = aliases.settled;
        const roundId = _brand === "round" ? roundCalc : `$${aliases.foreign}`;

        const roundCollection = this.getRoundCollection(summaryConfig);
        const timeFilter = { [time]: { $lt: new Date(Date.now() - 3_600_000) } };
        const warmingRound = await roundCollection
            .aggregate([{ $match: { [DO_FLAG]: true, ...timeFilter } }, { $project: { _id: 0, data: roundCalc } }, { $sort: { data: -1 } }, { $limit: 1 }])
            .map((_) => _.data)
            .toArray();
        const roundFilter = warmingRound.length ? { $expr: { $lt: [roundId, { $literal: warmingRound[0] }] } } : timeFilter;
        const doneFilter = { ...roundFilter, [settled]: true };

        return doneFilter;
    }

    protected async runSummary(summaryConfig: SC) {
        const aggregateOptions: AggregateOptions = { allowDiskUse: true };
        const {
            gameConfigs: { gameId },
        } = summaryConfig;

        const ticketCollection = getCollection(this.mongoClient, this.ticketSummariesNamespace);
        const pipeline: Document[] = roundSummaryPipelineFactory(summaryConfig, this.ticketSummariesNamespace, this.roundSummariesNamespace);

        await this.setDoSummaryFlag(ticketCollection, gameId);
        await ticketCollection.aggregate(pipeline, aggregateOptions).tryNext();

        const doneFilter = await this.buildSummaryDoneFilter(ticketCollection);
        await this.removeDoSummaryFlag(ticketCollection, doneFilter, gameId);
    }

    protected async buildSummaryDoneFilter(ticketCollection: Collection): Promise<Document> {
        const timeFilter = { time: { $lt: new Date(Date.now() - 3_600_000) } };
        const warmingRound = await ticketCollection
            .aggregate([{ $match: { [DO_FLAG]: true, ...timeFilter } }, { $project: { _id: 0, data: "$roundId" } }, { $sort: { data: -1 } }, { $limit: 1 }])
            .map((_) => _.data)
            .toArray();
        const doneFilter = warmingRound.length ? { $expr: { $lt: ["$roundId", { $literal: warmingRound[0] }] } } : timeFilter;

        return doneFilter;
    }

    protected async setDoSummaryFlag(collection: Collection, gameId?: number) {
        const { matchedCount, upsertedCount, modifiedCount } = await collection.updateMany(
            { $or: [{ [DONE_FLAG]: false }, { [DONE_FLAG]: null }], gameId },
            { $set: { [DO_FLAG]: true } }
        );

        this.logger.logDebug("", {
            title: this.className,
            subject: `#=${matchedCount} U=${upsertedCount} M=${modifiedCount}   (${collection.namespace})`,
        });
    }

    protected async removeDoSummaryFlag(collection: Collection, doneFilter: Document, gameId?: number) {
        console.log(new Date().toISOString(), collection.collectionName, inspect({ [DO_FLAG]: true, gameId, ...doneFilter }, false, null, true));
        const { matchedCount: matchedUpdated, modifiedCount: modifiedUpdated } = await collection.updateMany(
            { [DO_FLAG]: true, gameId, ...doneFilter },
            { $set: { [DONE_FLAG]: true } }
        );
        const { matchedCount: matchedRemoved, modifiedCount: modifiedRemoved } = await collection.updateMany({ [DO_FLAG]: true, gameId }, { $unset: { [DO_FLAG]: 1 } });

        this.logger.logDebug("", {
            title: this.className,
            subject: `+++ #=${matchedUpdated} M=${modifiedUpdated} +++   --- #=${matchedRemoved} M=${modifiedRemoved} ---   (${collection.namespace})`,
        });
    }

    protected handleError(error: unknown, component: string): void {
        if (error instanceof MongoServerError) {
            delete error.stack;
        }
        return super.handleError(error, component);
    }
}
