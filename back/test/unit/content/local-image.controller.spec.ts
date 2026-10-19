import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalImageController } from '../../../src/content/local-image.controller.js';

describe('LocalImageController', () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('serves a drama webp file from MEDIA_STORAGE_ROOT in development', async () => {
    root = await mkdtemp(join(tmpdir(), 'local-images-'));
    const imagePath = join(root, 'dramas', 'drama-1', 'images', 'poster');
    await mkdir(imagePath, { recursive: true });
    await writeFile(join(imagePath, 'image-1.webp'), 'image-data');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MEDIA_STORAGE_ROOT', root);
    const controller = new LocalImageController();

    const response = await controller.getDramaImage('drama-1', 'poster', 'image-1.webp');

    expect(response.getHeaders()).toMatchObject({ type: 'image/webp' });
    const chunks: Buffer[] = [];
    for await (const chunk of response.getStream()) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('image-data');
  });

  it('serves landscape poster files from the poster-landscape directory', async () => {
    root = await mkdtemp(join(tmpdir(), 'local-images-'));
    const imagePath = join(root, 'dramas', 'drama-1', 'images', 'poster-landscape');
    await mkdir(imagePath, { recursive: true });
    await writeFile(join(imagePath, 'image-1.webp'), 'landscape-image-data');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MEDIA_STORAGE_ROOT', root);
    const controller = new LocalImageController();

    const response = await controller.getDramaImage('drama-1', 'poster-landscape', 'image-1.webp');
    const chunks: Buffer[] = [];
    for await (const chunk of response.getStream()) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('landscape-image-data');
  });

  it.each([
    ['rejects video files', 'drama-1', 'poster', 'clip.mp4'],
    ['rejects unsupported image directories', 'drama-1', 'videos', 'image.webp'],
    ['rejects traversal in a path segment', '..', 'poster', 'image.webp'],
  ])('%s', async (_label, dramaId, kind, filename) => {
    root = await mkdtemp(join(tmpdir(), 'local-images-'));
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MEDIA_STORAGE_ROOT', root);
    const controller = new LocalImageController();

    await expect(controller.getDramaImage(dramaId, kind, filename)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not serve local files outside development', async () => {
    root = await mkdtemp(join(tmpdir(), 'local-images-'));
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MEDIA_STORAGE_ROOT', root);
    const controller = new LocalImageController();

    await expect(controller.getDramaImage('drama-1', 'poster', 'image.webp')).rejects.toBeInstanceOf(NotFoundException);
  });
});
