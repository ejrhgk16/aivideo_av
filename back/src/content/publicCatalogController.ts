import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PublicCatalogService } from './publicCatalogService.js';
import type {
  DramaDetailResponse,
  DramaSummaryResponse,
  EpisodePlaybackResponse,
  GenreResponse,
  PreviewPlaybackResponse,
} from './contentResponses.js';
import { OptionalJwtAuthGuard } from '../identity/optionalJwtAuthGuard.js';

type AuthenticatedRequest = Request & { user?: { uuid: string } };

@Controller()
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Get('dramas')
  @UseGuards(OptionalJwtAuthGuard)
  listDramas(@Query('sort') sort: string | undefined, @Req() request: AuthenticatedRequest): Promise<DramaSummaryResponse[]> {
    if (sort !== undefined && sort !== 'latest') {
      throw new BadRequestException('sort must be latest');
    }
    return this.publicCatalogService.listDramas('latest', undefined, request.user?.uuid);
  }

  @Get('dramas/:dramaId')
  @UseGuards(OptionalJwtAuthGuard)
  getDrama(
    @Param('dramaId') dramaId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DramaDetailResponse> {
    return this.publicCatalogService.getDrama(dramaId, undefined, request.user?.uuid);
  }

  @Get('episodes/:episodeId/playback')
  @UseGuards(OptionalJwtAuthGuard)
  getEpisodePlayback(
    @Param('episodeId') episodeId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EpisodePlaybackResponse> {
    return this.publicCatalogService.getEpisodePlaybackUrl(episodeId, request.user?.uuid);
  }

  @Get('dramas/:dramaId/previews/:videoId/playback')
  @UseGuards(OptionalJwtAuthGuard)
  getDramaPreviewPlayback(
    @Param('dramaId') dramaId: string,
    @Param('videoId') videoId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PreviewPlaybackResponse> {
    return this.publicCatalogService.getDramaPreviewPlaybackUrl(dramaId, videoId, request.user?.uuid);
  }

  @Get('genres')
  listGenres(): Promise<GenreResponse[]> {
    return this.publicCatalogService.listGenres();
  }
}
