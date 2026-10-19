/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinMediaUrl, resolveApiImageUrl, resolveImageUrl } from '../../src/common/media';

test('media keys join to a single-slash URL', () => {
  assert.equal(joinMediaUrl('http://localhost:3000/media/images/', '/signal.jpg'), 'http://localhost:3000/media/images/signal.jpg');
});

test('media keys preserve nested paths', () => {
  assert.equal(joinMediaUrl('https://cdn.example.com/videos', 'episodes/episode-1/full.mp4'), 'https://cdn.example.com/videos/episodes/episode-1/full.mp4');
});

test('relative API image paths resolve against the API base URL', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';

  try {
    assert.equal(resolveApiImageUrl('/media/images/dramas/example.webp'), 'http://localhost:3000/media/images/dramas/example.webp');
  } finally {
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('absolute API image URLs remain unchanged', () => {
  assert.equal(resolveApiImageUrl('https://cdn.example.com/signed-image.webp?token=abc'), 'https://cdn.example.com/signed-image.webp?token=abc');
});

test('null API image URLs remain null without requiring an API base URL', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;

  try {
    assert.equal(resolveApiImageUrl(null), null);
  } finally {
    if (originalBaseUrl !== undefined) process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('static demo image URLs still use the image base URL', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_IMAGE_BASE_URL;
  process.env.EXPO_PUBLIC_IMAGE_BASE_URL = 'http://localhost:3000/media/images/';

  try {
    assert.equal(resolveImageUrl('signal.jpg'), 'http://localhost:3000/media/images/signal.jpg');
  } finally {
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_IMAGE_BASE_URL;
    else process.env.EXPO_PUBLIC_IMAGE_BASE_URL = originalBaseUrl;
  }
});
