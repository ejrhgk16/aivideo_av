import { apiRequest } from '../user/sessionClient';
import type { PointHistoryPage } from './economyResponses';

export type { PointHistoryItem, PointHistoryPage, PointTransactionType } from './economyResponses';

export function getPointHistory(page = 1): Promise<PointHistoryPage> {
  return apiRequest<PointHistoryPage>(
    '/me/points/transactions?page=' + encodeURIComponent(page),
    { auth: 'required' },
  );
}
