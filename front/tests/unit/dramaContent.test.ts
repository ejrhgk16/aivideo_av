import type { DramaContent } from '../../src/features/drama/dramaContent';

let ApiError: typeof import('../../src/common/http/api').ApiError;
let dramaApi: typeof import('../../src/features/drama/dramaContent');
let configureSessionClient: typeof import('../../src/features/user/sessionClient').configureSessionClient;

beforeEach(() => {
  jest.isolateModules(() => {
    ({ ApiError } = require('../../src/common/http/api'));
    dramaApi = require('../../src/features/drama/dramaContent');
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

test('drama list requests the latest public catalog and returns the API response', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const responseBody = [{
    uuid: '00000002-0000-4000-8000-000000000001',
    slug: 'our-last-spring',
    title: '우리의 마지막 봄',
    shortDescription: '서로의 비밀을 간직한 두 사람의 봄날 로맨스',
    productionCompany: '라이트하우스 스튜디오',
    genres: [{ id: 1, code: 'ROMANCE', name: '로맨스' }],
    imageUrls: { poster: '/media/poster.webp', posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
    previewVideos: [],
    episodeCount: 4,
    freeEpisodeCount: 1,
  }];

  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';
  globalThis.fetch = (async (input) => {
    requestedUrls.push(String(input));
    return { ok: true, json: async () => responseBody } as Response;
  }) as typeof fetch;

  try {
    configureApiClient();
    const result = await dramaApi.getDramaList();

    expect(requestedUrls).toEqual(['http://localhost:3000/dramas?sort=latest']);
    expect(result).toEqual(responseBody);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('drama list request reports an unsuccessful response', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => ({ ok: false, status: 503 }) as Response) as typeof fetch;

  try {
    configureApiClient();
    const request = dramaApi.getDramaList();
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 503 });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('drama detail requests use the configured API base URL and return the API contract', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const responseBody = {
    uuid: '00000002-0000-4000-8000-000000000001',
    slug: 'our-last-spring',
    title: '우리의 마지막 봄',
    shortDescription: '서로의 비밀을 간직한 두 사람의 봄날 로맨스',
    synopsis: '마지막 봄에 다시 만난다.',
    productionCompany: '라이트하우스 스튜디오',
    genres: [{ id: 1, code: 'ROMANCE', name: '로맨스' }],
    imageUrls: {
      poster: '/media/images/dramas/example/images/poster/image-1.webp',
      posterLandscape: '/media/images/dramas/example/images/poster-landscape/image-1.webp',
      homeHero: null,
      detailCover: null,
      campaigns: [],
    },
    previewVideos: [{ uuid: '00000002-0000-4000-8000-000000000201', storageKey: 'dramas/our-last-spring/videos/preview-1.mp4', durationMs: 30000, isSaved: false }],
    episodes: [{
      uuid: '00000002-0000-4000-8000-000000000101',
      episodeNumber: 1,
      title: '다시 만난 봄',
      synopsis: '우연한 재회가 시작된다.',
      durationMs: 420000,
      videoUuid: '00000004-0000-4000-8000-000000000101',
      isSaved: true,
      pricePoints: 0,
      isUnlocked: true,
      image: null,
      watchProgress: {
        positionMs: 0,
        isCompleted: false,
        lastPlayedAt: '2026-10-08T12:34:56.789Z',
      },
    }, {
      uuid: '00000002-0000-4000-8000-000000000102',
      episodeNumber: 2,
      title: null,
      synopsis: null,
      durationMs: 435000,
      videoUuid: null,
      isSaved: false,
      pricePoints: 30,
      isUnlocked: false,
      image: null,
      watchProgress: null,
    }],
  } satisfies DramaContent;

  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';
  globalThis.fetch = (async (input) => {
    requestedUrls.push(String(input));
    return { ok: true, json: async () => responseBody } as Response;
  }) as typeof fetch;

  try {
    configureApiClient();
    const result = await dramaApi.getDramaContent(responseBody.uuid);

    expect(requestedUrls).toEqual(['http://localhost:3000/dramas/00000002-0000-4000-8000-000000000001']);
    expect(result).toEqual(responseBody);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('drama detail does not accept a caller-selected user UUID', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async (input) => {
    requestedUrls.push(String(input));
    return { ok: true, json: async () => ({ episodes: [{ pricePoints: 30, isUnlocked: true }] }) } as Response;
  }) as typeof fetch;

  try {
    configureApiClient();
    const result = await dramaApi.getDramaContent('drama id');
    expect(requestedUrls).toEqual(['http://localhost:3000/dramas/drama%20id']);
    expect(result.episodes[0].isUnlocked).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('optional drama detail sends the current Access token without a user UUID query', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), headers: init?.headers });
    return { ok: true, json: async () => ({ episodes: [] }) } as Response;
  }) as typeof fetch;

  try {
    const client = configureApiClient();
    await client.login({ loginId: 'test', password: 'test' });
    await dramaApi.getDramaContent('drama-1');
    expect(requests[0].url).toBe('http://localhost:3000/dramas/drama-1');
    expect((requests[0].headers as Record<string, string>).Authorization).toBe('Bearer access-token');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('drama list sends the optional Access token when signed in', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), headers: init?.headers });
    return { ok: true, json: async () => [] } as Response;
  }) as typeof fetch;

  try {
    const client = configureApiClient();
    await client.login({ loginId: 'test', password: 'test' });
    await dramaApi.getDramaList();
    expect(requests[0].url).toBe('http://localhost:3000/dramas?sort=latest');
    expect((requests[0].headers as Record<string, string>).Authorization).toBe('Bearer access-token');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('drama detail request reports an unsuccessful response', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => ({ ok: false, status: 404 }) as Response) as typeof fetch;

  try {
    configureApiClient();
    const request = dramaApi.getDramaContent('unknown');
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 404 });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
