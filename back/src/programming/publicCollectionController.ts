import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../identity/optionalJwtAuthGuard.js';

import { PublicCollectionService } from './publicCollectionService.js';
import type { PublicCollectionResponse } from './programmingResponses.js';

@Controller('collections')
export class PublicCollectionController {
  constructor(private readonly collectionService: PublicCollectionService) {}

  @Get(':code')
  @UseGuards(OptionalJwtAuthGuard)
  getCollection(@Param('code') code: string, @Req() request: Request & { user?: { uuid: string } }): Promise<PublicCollectionResponse> {
    return this.collectionService.getCollection(code, request.user?.uuid);
  }
}
