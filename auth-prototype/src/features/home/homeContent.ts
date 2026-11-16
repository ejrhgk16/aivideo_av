import { apiRequest } from '../user/sessionClient';
import type { HomeCollection } from './homeResponses';

export type { HomeCollection, HomeCollectionDrama } from './homeResponses';

export async function getHomeCollection(code: string): Promise<HomeCollection> {
  return apiRequest<HomeCollection>(`/collections/${encodeURIComponent(code.replace(/^\/+/, ''))}`, { auth: 'optional' });
}
