import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PublicCatalogService } from './public-catalog.service.js';

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

  @Get('genres')
  listGenres() {
    return this.publicCatalogService.listGenres();
  }
}
