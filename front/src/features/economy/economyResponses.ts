export type EpisodePurchaseResponse = {
  episodeUuid: string;
  entitlementUuid: string | null;
  chargedPoints: number;
  availablePoints: number;
};

export type PointTransactionType =
  | 'PURCHASE'
  | 'AD_REWARD'
  | 'EPISODE_UNLOCK'
  | 'ADMIN_ADJUSTMENT'
  | 'REFUND';

export type PointHistoryItem = {
  uuid: string;
  transactionType: PointTransactionType;
  amount: number;
  balanceAfter: number;
  createdAt: string;
  episode: { dramaTitle: string; episodeNumber: number } | null;
};

export type PointHistoryPage = {
  items: PointHistoryItem[];
  page: number;
  hasNext: boolean;
};
