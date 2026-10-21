/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveApiImageUrl } from '../../src/common/media';

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

