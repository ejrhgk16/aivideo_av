import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import { Controller, Get, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { getMediaStorageRoot, resolveMediaStoragePath } from './media-storage.js';
import { PublicCatalogService } from './public-catalog.service.js';

@Controller('media/videos')
export class LocalVideoController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Get('episodes/:episodeId')
  async getEpisodeVideo(@Param('episodeId') episodeId: string): Promise<StreamableFile> {
    if (
      process.env.NODE_ENV !== 'development' ||
      !episodeId ||
      episodeId === '.' ||
      episodeId === '..' ||
      episodeId.includes('/') ||
      episodeId.includes('\\')
    ) {
      throw new NotFoundException();
    }

    const storageKey = await this.publicCatalogService.getEpisodeVideoStorageKey(episodeId);
    if (!storageKey.endsWith('.mp4')) throw new NotFoundException();
    let filePath: string;
    let storageRoot: string;
    try {
      filePath = resolveMediaStoragePath(storageKey);
      storageRoot = await realpath(getMediaStorageRoot());
      filePath = await realpath(filePath);
      const rootRelativePath = relative(storageRoot, filePath);
      if (
        rootRelativePath === '' ||
        rootRelativePath === '..' ||
        rootRelativePath.startsWith(`..${sep}`) ||
        isAbsolute(rootRelativePath) ||
        !(await stat(filePath)).isFile()
      ) {
        throw new NotFoundException();
      }
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException();
    }

    return new StreamableFile(createReadStream(filePath), { type: 'video/mp4' });
  }
}
