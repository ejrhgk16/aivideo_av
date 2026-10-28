import { BadRequestException, Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import { PublicCatalogService } from './publicCatalogService.js';
import { AllExceptionFilter } from '../common/error/error.filter.js';

@Controller()
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Get('dramas')
  listDramas(@Query('sort') sort?: string) {
    if (sort !== undefined && sort !== 'latest') {
      throw new BadRequestException('sort must be latest');
    }
    return this.publicCatalogService.listDramas('latest');
  }

  @Get('dramas/:dramaId')
  getDrama(
    @Param('dramaId') dramaId: string,
    @Query('userUuid') userUuid?: unknown,
  ) {
    if (userUuid !== undefined && (
      typeof userUuid !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)
    )) {
      throw new BadRequestException('userUuid must be a UUID');
    }
    return this.publicCatalogService.getDrama(dramaId, undefined, userUuid);
  }

  @Get('episodes/:episodeId/playback')
  @UseFilters(AllExceptionFilter)
  getEpisodePlayback(
    @Param('episodeId') episodeId: string,
    @Query('userUuid') userUuid?: unknown,
  ) {
    if (userUuid !== undefined && (
      typeof userUuid !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)
    )) {
      throw new BadRequestException('userUuid must be a UUID');
    }
    return this.publicCatalogService.getEpisodePlaybackUrl(episodeId, userUuid);
  }

  @Get('dramas/:dramaId/previews/:videoId/playback')
  getDramaPreviewPlayback(
    @Param('dramaId') dramaId: string,
    @Param('videoId') videoId: string,
  ) {
    return this.publicCatalogService.getDramaPreviewPlaybackUrl(dramaId, videoId);
  }

  @Get('genres')
  listGenres() {
    return this.publicCatalogService.listGenres();
  }
}
