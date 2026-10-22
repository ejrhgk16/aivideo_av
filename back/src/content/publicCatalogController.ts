import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { PublicCatalogService } from './publicCatalogService.js';

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
  getDrama(@Param('dramaId') dramaId: string) {
    return this.publicCatalogService.getDrama(dramaId);
  }

  @Get('episodes/:episodeId/playback')
  getEpisodePlayback(@Param('episodeId') episodeId: string) {
    return this.publicCatalogService.getEpisodePlaybackUrl(episodeId);
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
