type DramaImageStorageKeys = {
  poster: string | null;
  homeHero: string | null;
  detailCover: string | null;
  campaigns: string[];
};

export type DramaImageUrls = {
  poster: string | null;
  homeHero: string | null;
  detailCover: string | null;
  campaigns: string[];
};

function localImageUrl(storageKey: string, environment: NodeJS.ProcessEnv): string | null {
  if (environment.NODE_ENV !== 'development') return null;
  return `/media/images/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
}

export function createDramaImageUrls(
  images: DramaImageStorageKeys,
  environment: NodeJS.ProcessEnv = process.env,
): DramaImageUrls {
  return {
    poster: images.poster ? localImageUrl(images.poster, environment) : null,
    homeHero: images.homeHero ? localImageUrl(images.homeHero, environment) : null,
    detailCover: images.detailCover ? localImageUrl(images.detailCover, environment) : null,
    campaigns: images.campaigns.flatMap((storageKey) => {
      const url = localImageUrl(storageKey, environment);
      return url ? [url] : [];
    }),
  };
}
