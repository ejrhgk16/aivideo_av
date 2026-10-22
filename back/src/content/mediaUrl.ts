type DramaImageStorageKeys = {
  poster: string | null;
  posterLandscape: string | null;
  homeHero: string | null;
  detailCover: string | null;
  campaigns: string[];
};

export type DramaImageUrls = {
  poster: string | null;
  posterLandscape: string | null;
  homeHero: string | null;
  detailCover: string | null;
  campaigns: string[];
};

function publicImageUrl(storageKey: string, environment: NodeJS.ProcessEnv): string | null {
  const { AWS_REGION: region, S3_BUCKET: bucket } = environment;
  if (!region || !bucket) return null;
  const encodedKey = storageKey.split('/').map(encodeURIComponent).join('/');
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

export function createDramaImageUrls(
  images: DramaImageStorageKeys,
  environment: NodeJS.ProcessEnv = process.env,
): DramaImageUrls {
  return {
    poster: images.poster ? publicImageUrl(images.poster, environment) : null,
    posterLandscape: images.posterLandscape ? publicImageUrl(images.posterLandscape, environment) : null,
    homeHero: images.homeHero ? publicImageUrl(images.homeHero, environment) : null,
    detailCover: images.detailCover ? publicImageUrl(images.detailCover, environment) : null,
    campaigns: images.campaigns.flatMap((storageKey) => {
      const url = publicImageUrl(storageKey, environment);
      return url ? [url] : [];
    }),
  };
}
