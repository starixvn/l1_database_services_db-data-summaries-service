import { Document } from "bson";
import { SummaryConfig } from "./summary-config";

export type SummaryPipelineFactory<TConfig extends SummaryConfig> = (...args: [TConfig]) => Document[];

export type TimePipelineFactory = (...args: [string]) => Document[];
