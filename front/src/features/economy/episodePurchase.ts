import { apiRequest } from '../user/sessionClient';
import type { EpisodePurchaseResponse } from './economyResponses';

export type { EpisodePurchaseResponse } from './economyResponses';

export function purchaseEpisode(episodeUuid: string): Promise<EpisodePurchaseResponse> {
  return apiRequest<EpisodePurchaseResponse>(
    `/me/episodes/${encodeURIComponent(episodeUuid)}/purchaseSingle`,
    { auth: 'required', method: 'POST' },
  );
}
