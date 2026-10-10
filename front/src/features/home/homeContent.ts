export interface HomeCollectionDrama {
  displayOrder: number;
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: { id: string; name: string } | null;
  genres: Array<{ id: number; code: string; name: string }>;
  images: {
    POSTER: string | null;
    HERO: string | null;
    THUMBNAIL: string | null;
  };
  publishedEpisodeCount: number;
  freeEpisodeCount: number;
}

export interface HomeCollection {
  code: string;
  title: string;
  description: string | null;
  dramas: HomeCollectionDrama[];
}

function joinApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export async function getHomeCollection(code: string): Promise<HomeCollection> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch home content.');
  }

  const response = await fetch(joinApiUrl(baseUrl, `collections/${code.replace(/^\/+/, '')}`));
  if (!response.ok) {
    throw new Error(`Failed to fetch collection '${code}': ${response.status}`);
  }

  return (await response.json()) as HomeCollection;
}
