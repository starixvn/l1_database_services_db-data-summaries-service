export type OperatorRawSummarySchema = {
    operatorId: string;
    targetDate: string;
    siteId: string;
    currencyIso: string;
    actualStake: string;
    betCount: string;
    winLose: string;
};

export type OperatorSummarySchema = {
    operatorId: string;
    time: Date;
    siteId: string;
    currency: string;
    stake: number;
    tickets: number;
    winloss: number;
};
