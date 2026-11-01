export type IncreasePointsResponse = {
  uuid: string;
  amount: number;
  balanceAfter: number;
};

export type PurchaseEpisodeResponse = {
  episodeUuid: string;
  entitlementUuid: string | null;
  chargedPoints: number;
  availablePoints: number;
};
