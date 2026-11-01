import { apiRequest } from '../user/sessionClient';
import type { DramaContent, DramaSummary } from './dramaResponses';

export type { DramaContent, DramaSummary } from './dramaResponses';

export function getDramaContent(dramaId: string): Promise<DramaContent> {
  return apiRequest<DramaContent>(`/dramas/${encodeURIComponent(dramaId)}`, { auth: 'optional' });
}

export function getDramaList(): Promise<DramaSummary[]> {
  return apiRequest<DramaSummary[]>('/dramas?sort=latest', { auth: 'optional' });
}
