export interface EpisodePurchaseResponse {
  episodeUuid: string;
  entitlementUuid: string | null;
  chargedPoints: number;
  availablePoints: number;
}

export class EpisodePurchaseError extends Error {
  constructor(public readonly status: number, public readonly errorCode?: string) {
    super(`Failed to purchase episode: ${status}`);
  }
}

export async function purchaseEpisode(
  userUuid: string,
  episodeUuid: string,
): Promise<EpisodePurchaseResponse> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to purchase an episode.');
  }

  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/users/${encodeURIComponent(userUuid)}/episodes/${encodeURIComponent(episodeUuid)}/purchaseSingle`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const errorCode = body !== null && typeof body === 'object'
      && 'errorCode' in body && typeof body.errorCode === 'string'
      ? body.errorCode : undefined;
    throw new EpisodePurchaseError(response.status, errorCode);
  }

  return await response.json() as EpisodePurchaseResponse;
}
