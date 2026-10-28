import { BadRequestException, Controller, Get, Param, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PublicCatalogService } from './publicCatalogService.js';
import { AllExceptionFilter } from '../common/error/error.filter.js';
import { OptionalJwtAuthGuard } from '../identity/optionalJwtAuthGuard.js';

type AuthenticatedRequest = Request & { user?: { uuid: string } };

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
  @UseGuards(OptionalJwtAuthGuard)
  @UseFilters(AllExceptionFilter)
  getDrama(
    @Param('dramaId') dramaId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.publicCatalogService.getDrama(dramaId, undefined, request.user?.uuid);
  }

  @Get('episodes/:episodeId/playback')
  @UseGuards(OptionalJwtAuthGuard)
  @UseFilters(AllExceptionFilter)
  getEpisodePlayback(
    @Param('episodeId') episodeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.publicCatalogService.getEpisodePlaybackUrl(episodeId, request.user?.uuid);
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
