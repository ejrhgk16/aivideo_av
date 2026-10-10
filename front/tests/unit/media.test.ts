/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinMediaUrl } from '../../src/common/media';

test('media keys join to a single-slash URL', () => {
  assert.equal(joinMediaUrl('http://localhost:3000/media/images/', '/signal.jpg'), 'http://localhost:3000/media/images/signal.jpg');
});

test('media keys preserve nested paths', () => {
  assert.equal(joinMediaUrl('https://cdn.example.com/videos', 'episodes/episode-1/full.mp4'), 'https://cdn.example.com/videos/episodes/episode-1/full.mp4');
});
