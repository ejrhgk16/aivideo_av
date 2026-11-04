import type { PageResponse } from '../common/pagination/paginationResponses.js';

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

export type PointTransactionType =
  | 'PURCHASE'
  | 'AD_REWARD'
  | 'EPISODE_UNLOCK'
  | 'ADMIN_ADJUSTMENT'
  | 'REFUND';

export type PointHistoryItemResponse = {
  uuid: string;
  transactionType: PointTransactionType;
  amount: number;
  balanceAfter: number;
  createdAt: string;
  episode: { dramaTitle: string; episodeNumber: number } | null;
};

export type PointHistoryPageResponse = PageResponse<PointHistoryItemResponse>;
