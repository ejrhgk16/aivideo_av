import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import { Controller, Get, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { getMediaStorageRoot, resolveMediaStoragePath } from './media-storage.js';

const IMAGE_KIND_PATTERN = /^(poster|poster-landscape|home-hero|detail-cover|campaign)$/;
const FILENAME_PATTERN = /^[^/\\]+\.webp$/;

@Controller('media/images')
export class LocalImageController {
  @Get('dramas/:dramaId/images/:kind/:filename')
  async getDramaImage(
    @Param('dramaId') dramaId: string,
    @Param('kind') kind: string,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    if (
      process.env.NODE_ENV !== 'development' ||
      !dramaId ||
      dramaId === '.' ||
      dramaId === '..' ||
      dramaId.includes('/') ||
      dramaId.includes('\\') ||
      !IMAGE_KIND_PATTERN.test(kind) ||
      !FILENAME_PATTERN.test(filename)
    ) {
      throw new NotFoundException();
    }

    const storageKey = `dramas/${dramaId}/images/${kind}/${filename}`;
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

    return new StreamableFile(createReadStream(filePath), { type: 'image/webp' });
  }
}
