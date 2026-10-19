/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHomeCollection, type HomeCollection } from '../../src/features/home/homeContent';

test('home collection requests use the configured API base URL', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const responseBody = {
    code: 'HOME_FEATURED',
    title: '오늘의 추천',
    description: '지금 만나보세요',
    dramas: [
      {
        displayOrder: 1,
        id: '00000002-0000-4000-8000-000000000001',
        slug: 'our-last-spring',
        title: '우리의 마지막 봄',
        shortDescription: '서로의 비밀을 간직한 두 사람의 봄날 로맨스',
        productionCompany: null,
        genres: [{ id: 1, code: 'ROMANCE', name: '로맨스' }],
        images: {
          poster: null,
          homeHero: null,
          detailCover: null,
          campaigns: ['dramas/our-last-spring/images/campaign-1.webp'],
        },
        imageUrls: {
          poster: null,
          homeHero: '/media/images/dramas/example/images/home-hero/image-1.webp',
          detailCover: null,
          campaigns: [],
        },
        previewVideos: [
          { storageKey: 'dramas/our-last-spring/videos/preview-1.mp4', durationMs: 30000 },
        ],
        publishedEpisodeCount: 4,
        freeEpisodeCount: 1,
      },
    ],
  } satisfies HomeCollection;

  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';
  globalThis.fetch = (async (input) => {
    requestedUrls.push(String(input));
    return {
      ok: true,
      json: async () => responseBody,
    } as Response;
  }) as typeof fetch;

  try {
    const result = await getHomeCollection('/HOME_FEATURED');
    await getHomeCollection('EDITORIAL_TOP_3');
    await getHomeCollection('RECOMMENDATION_DAILY');

    assert.deepEqual(requestedUrls, [
      'http://localhost:3000/collections/HOME_FEATURED',
      'http://localhost:3000/collections/EDITORIAL_TOP_3',
      'http://localhost:3000/collections/RECOMMENDATION_DAILY',
    ]);
    assert.deepEqual(result, responseBody);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
