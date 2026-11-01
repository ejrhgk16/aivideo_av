export type EpisodePurchaseResponse = {
  episodeUuid: string;
  entitlementUuid: string | null;
  chargedPoints: number;
  availablePoints: number;
};
