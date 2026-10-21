import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalVideoController } from '../../../src/content/local-video.controller.js';
import { PublicCatalogService } from '../../../src/content/public-catalog.service.js';

describe('LocalVideoController', () => {
  let root: string;
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('serves a published episode MP4 with video content type in development', async () => {
    root = await mkdtemp(join(tmpdir(), 'local-videos-'));
    const videoDirectory = join(root, 'dramas', 'drama-1', 'episodes', 'episode-1', 'videos');
    await mkdir(videoDirectory, { recursive: true });
    await writeFile(join(videoDirectory, 'full.mp4'), 'video-data');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MEDIA_STORAGE_ROOT', root);
    const catalog = { getEpisodeVideoStorageKey: vi.fn().mockResolvedValue('dramas/drama-1/episodes/episode-1/videos/full.mp4') };
    const controller = new LocalVideoController(catalog as unknown as PublicCatalogService);

    const response = await controller.getEpisodeVideo('episode-1');

    expect(catalog.getEpisodeVideoStorageKey).toHaveBeenCalledWith('episode-1');
    expect(response.getHeaders()).toMatchObject({ type: 'video/mp4' });
    const chunks: Buffer[] = [];
    for await (const chunk of response.getStream()) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('video-data');
  });

  it('rejects missing files, directories, and paths outside MEDIA_STORAGE_ROOT', async () => {
    root = await mkdtemp(join(tmpdir(), 'local-videos-'));
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MEDIA_STORAGE_ROOT', root);
    const catalog = { getEpisodeVideoStorageKey: vi.fn() };
    const controller = new LocalVideoController(catalog as unknown as PublicCatalogService);

    catalog.getEpisodeVideoStorageKey.mockResolvedValue('dramas');
    await expect(controller.getEpisodeVideo('episode-1')).rejects.toBeInstanceOf(NotFoundException);
    catalog.getEpisodeVideoStorageKey.mockResolvedValue('missing.mp4');
    await expect(controller.getEpisodeVideo('episode-1')).rejects.toBeInstanceOf(NotFoundException);
    catalog.getEpisodeVideoStorageKey.mockResolvedValue('../outside.mp4');
    await expect(controller.getEpisodeVideo('episode-1')).rejects.toBeInstanceOf(NotFoundException);
    catalog.getEpisodeVideoStorageKey.mockResolvedValue('video.webp');
    await expect(controller.getEpisodeVideo('episode-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not serve local video outside development', async () => {
    root = await mkdtemp(join(tmpdir(), 'local-videos-'));
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MEDIA_STORAGE_ROOT', root);
    const catalog = { getEpisodeVideoStorageKey: vi.fn() };
    const controller = new LocalVideoController(catalog as unknown as PublicCatalogService);

    await expect(controller.getEpisodeVideo('episode-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(catalog.getEpisodeVideoStorageKey).not.toHaveBeenCalled();
  });
});
