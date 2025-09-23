import { type Metadata } from "@ldb/utils";

export const name = "data-summaries-service" as const;
export const version = "3.5.1" as const;

export const metadata = { name, version } as const satisfies Metadata;
