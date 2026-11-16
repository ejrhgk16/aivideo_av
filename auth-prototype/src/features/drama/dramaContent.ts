import { apiRequest } from '../user/sessionClient';
import type { DramaContent, DramaListPage, DramaListParams, DramaSummary, GenreSummary } from './dramaResponses';

export type { DramaContent, DramaListPage, DramaListParams, DramaSummary, GenreSummary } from './dramaResponses';

export function getDramaContent(dramaId: string): Promise<DramaContent> {
  return apiRequest<DramaContent>(`/dramas/${encodeURIComponent(dramaId)}`, { auth: 'optional' });
}

export function getDramaList(params: DramaListParams = {}): Promise<DramaListPage> {
  let path = '/dramas?sort=latest&page=' + encodeURIComponent(params.page ?? 1);
  const q = params.q?.trim();
  const genre = params.genre?.trim();
  if (q) path += '&q=' + encodeURIComponent(q);
  if (genre) path += '&genre=' + encodeURIComponent(genre);
  return apiRequest<DramaListPage>(path, { auth: 'optional' });
}

export function getGenres(): Promise<GenreSummary[]> {
  return apiRequest<GenreSummary[]>('/genres', { auth: 'public' });
}
