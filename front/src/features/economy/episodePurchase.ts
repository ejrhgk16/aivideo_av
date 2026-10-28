import { apiRequest } from '../user/sessionClient';

export interface EpisodePurchaseResponse {
  episodeUuid: string;
  entitlementUuid: string | null;
  chargedPoints: number;
  availablePoints: number;
}

export function purchaseEpisode(episodeUuid: string): Promise<EpisodePurchaseResponse> {
  return apiRequest<EpisodePurchaseResponse>(
    `/me/episodes/${encodeURIComponent(episodeUuid)}/purchaseSingle`,
    { auth: 'required', method: 'POST' },
  );
}
