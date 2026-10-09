import { Controller, Get, Param } from '@nestjs/common';

import {
  PublicCollectionResponse,
  PublicCollectionService,
} from './public-collection.service.js';

@Controller('collections')
export class PublicCollectionController {
  constructor(private readonly collectionService: PublicCollectionService) {}

  @Get(':code')
  getCollection(@Param('code') code: string): Promise<PublicCollectionResponse> {
    return this.collectionService.getCollection(code);
  }
}
