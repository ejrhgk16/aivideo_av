/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDramaContent, getDramaList, type DramaContent } from '../../src/features/drama/dramaContent';

test('drama list requests the latest public catalog and returns the API response', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const responseBody = [{
    id: '00000002-0000-4000-8000-000000000001',
    slug: 'our-last-spring',
    title: '우리의 마지막 봄',
    shortDescription: '서로의 비밀을 간직한 두 사람의 봄날 로맨스',
    productionCompany: '라이트하우스 스튜디오',
    genres: [{ id: 1, code: 'ROMANCE', name: '로맨스' }],
    images: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
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
    const result = await getDramaList();

    assert.deepEqual(requestedUrls, ['http://localhost:3000/dramas?sort=latest']);
    assert.deepEqual(result, responseBody);
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
    await assert.rejects(getDramaList(), /Failed to fetch drama list: 503/);
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
    id: '00000002-0000-4000-8000-000000000001',
    slug: 'our-last-spring',
    title: '우리의 마지막 봄',
    shortDescription: '서로의 비밀을 간직한 두 사람의 봄날 로맨스',
    synopsis: '마지막 봄에 다시 만난다.',
    productionCompany: '라이트하우스 스튜디오',
    genres: [{ id: 1, code: 'ROMANCE', name: '로맨스' }],
    images: {
      poster: 'dramas/our-last-spring/images/poster.webp',
      posterLandscape: 'dramas/our-last-spring/images/poster-landscape/image-1.webp',
      homeHero: 'dramas/our-last-spring/images/home-hero.webp',
      detailCover: null,
      campaigns: [],
    },
    imageUrls: {
      poster: '/media/images/dramas/example/images/poster/image-1.webp',
      posterLandscape: '/media/images/dramas/example/images/poster-landscape/image-1.webp',
      homeHero: null,
      detailCover: null,
      campaigns: [],
    },
    previewVideos: [{ storageKey: 'dramas/our-last-spring/videos/preview-1.mp4', durationMs: 30000 }],
    episodes: [{
      id: '00000002-0000-4000-8000-000000000101',
      episodeNumber: 1,
      title: '다시 만난 봄',
      synopsis: '우연한 재회가 시작된다.',
      durationMs: 420000,
      pricePoints: 0,
      image: null,
    }],
  } satisfies DramaContent;

  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';
  globalThis.fetch = (async (input) => {
    requestedUrls.push(String(input));
    return { ok: true, json: async () => responseBody } as Response;
  }) as typeof fetch;

  try {
    const result = await getDramaContent(responseBody.id);

    assert.deepEqual(requestedUrls, ['http://localhost:3000/dramas/00000002-0000-4000-8000-000000000001']);
    assert.deepEqual(result, responseBody);
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
    await assert.rejects(getDramaContent('unknown'), /Failed to fetch drama 'unknown': 404/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
