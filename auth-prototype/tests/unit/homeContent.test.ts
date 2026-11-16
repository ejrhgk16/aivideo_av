import type { HomeCollection } from '../../src/features/home/homeContent';

let homeApi: typeof import('../../src/features/home/homeContent');
let configureSessionClient: typeof import('../../src/features/user/sessionClient').configureSessionClient;

beforeEach(() => {
  jest.isolateModules(() => {
    homeApi = require('../../src/features/home/homeContent');
    ({ configureSessionClient } = require('../../src/features/user/sessionClient'));
  });
});

function configureApiClient() {
  return configureSessionClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    storage: { read: async () => null, write: async () => {}, remove: async () => {} },
    fetcher: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
    loginRequest: async () => ({ uuid: 'user-1', displayName: null, accountType: 'MEMBER', availablePoints: 80, accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900 }),
  });
}

test('home collection requests use the configured API base URL', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const requestedInit: (RequestInit | undefined)[] = [];
  const responseBody = {
    code: 'HOME_FEATURED',
    title: '오늘의 추천',
    description: '지금 만나보세요',
    dramas: [
      {
        displayOrder: 1,
        uuid: '00000002-0000-4000-8000-000000000001',
        slug: 'our-last-spring',
        title: '우리의 마지막 봄',
        shortDescription: '서로의 비밀을 간직한 두 사람의 봄날 로맨스',
        productionCompany: { uuid: '00000001-0000-4000-8000-000000000001', name: '라이트하우스 스튜디오' },
        genres: [{ id: 1, code: 'ROMANCE', name: '로맨스' }],
        imageUrls: {
          poster: null,
          posterLandscape: '/media/images/dramas/example/images/poster-landscape/image-1.webp',
          homeHero: '/media/images/dramas/example/images/home-hero/image-1.webp',
          detailCover: null,
          campaigns: [],
        },
        previewVideos: [
          { uuid: '00000002-0000-4000-8000-000000000201', storageKey: 'dramas/our-last-spring/videos/preview-1.mp4', durationMs: 30000, isSaved: false },
        ],
        publishedEpisodeCount: 4,
        freeEpisodeCount: 1,
      },
    ],
  } satisfies HomeCollection;

  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';
  globalThis.fetch = (async (input, init) => {
    requestedUrls.push(String(input));
    requestedInit.push(init);
    return {
      ok: true,
      json: async () => responseBody,
    } as Response;
  }) as typeof fetch;

  try {
    configureApiClient();
    const result = await homeApi.getHomeCollection('/HOME_FEATURED');
    await homeApi.getHomeCollection('EDITORIAL_TOP_3');
    await homeApi.getHomeCollection('RECOMMENDATION_DAILY');
    await homeApi.getHomeCollection('HOME_CAMPAIGN');

    expect(requestedUrls).toEqual([
      'http://localhost:3000/collections/HOME_FEATURED',
      'http://localhost:3000/collections/EDITORIAL_TOP_3',
      'http://localhost:3000/collections/RECOMMENDATION_DAILY',
      'http://localhost:3000/collections/HOME_CAMPAIGN',
    ]);
    expect(requestedInit.every((init) => !(init?.headers as Record<string, string>).Authorization)).toBe(true);
    expect(result).toEqual(responseBody);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('home collection sends an optional Access token when signed in', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const headers: HeadersInit[] = [];
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async (_input, init) => {
    headers.push(init?.headers ?? {});
    return { ok: true, json: async () => ({ code: 'HOME_FEATURED', title: 'Home', description: null, dramas: [] }) } as Response;
  }) as typeof fetch;

  try {
    const client = configureApiClient();
    await client.login({ loginId: 'test', password: 'test' });
    await homeApi.getHomeCollection('HOME_FEATURED');
    expect((headers[0] as Record<string, string>).Authorization).toBe('Bearer access-token');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
