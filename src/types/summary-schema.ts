export type TicketSummary = {
    gameId: number;
    roundId: number;
    playerId: string;
    siteId: string;
    operatorId: string;
    time: Date;
    currency: string;
    tickets: number;
    stake: number;
    payout: number;
    winloss: number;
    refund: number;
};

export type RoundSummary = {
    gameId: number;
    roundId: number;
    siteId: string;
    operatorId: string;
    time: Date;
    currency: string;
    tickets: number;
    stake: number;
    payout: number;
    winloss: number;
    refund: number;
    players: number;
    playerIds: string[];
};

export type TimeSummary = {
    gameId: number;
    siteId: string;
    operatorId: string;
    time: Date;
    currency: string;
    tickets: number;
    stake: number;
    payout: number;
    winloss: number;
    refund: number;
    players: number;
    playerIds: string[];
}
