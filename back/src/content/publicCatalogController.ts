import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PublicCatalogService } from './publicCatalogService.js';
import type {
  DramaDetailResponse,
  DramaPageResponse,
  EpisodePlaybackResponse,
  GenreResponse,
  PreviewPlaybackResponse,
} from './contentResponses.js';
import { OptionalJwtAuthGuard } from '../identity/optionalJwtAuthGuard.js';
import { parsePage } from '../common/pagination/pagination.js';
import { DRAMA_PAGE_SIZE, type DramaListOptions } from './publicCatalogService.js';

type AuthenticatedRequest = Request & { user?: { uuid: string } };

@Controller()
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Get('dramas')
  @UseGuards(OptionalJwtAuthGuard)
  listDramas(
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ): Promise<DramaPageResponse> {
    if (Object.keys(query).some((key) => /^(sort|page|q|genre)\[/.test(key))) {
      throw new BadRequestException('Invalid query parameter');
    }

    if (query.sort !== undefined && query.sort !== 'latest') {
      throw new BadRequestException('sort must be latest');
    }

    const readText = (value: unknown): string | undefined => {
      if (value === undefined) return undefined;
      if (typeof value !== 'string') throw new BadRequestException('Invalid filter');
      return value.trim() || undefined;
    };

    const page = parsePage(query.page, DRAMA_PAGE_SIZE);
    const q = readText(query.q);
    const genre = readText(query.genre);
    const options: DramaListOptions = {
      page,
      ...(q ? { q } : {}),
      ...(genre ? { genre } : {}),
    };
    return this.publicCatalogService.listDramas(options, undefined, request.user?.uuid);
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
