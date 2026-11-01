import { Controller, Get, Param, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AllExceptionFilter } from '../common/error/error.filter.js';
import { OptionalJwtAuthGuard } from '../identity/optionalJwtAuthGuard.js';

import {
  PublicCollectionResponse,
  PublicCollectionService,
} from './publicCollectionService.js';

@Controller('collections')
export class PublicCollectionController {
  constructor(private readonly collectionService: PublicCollectionService) {}

  @Get(':code')
  @UseGuards(OptionalJwtAuthGuard)
  @UseFilters(AllExceptionFilter)
  getCollection(@Param('code') code: string, @Req() request: Request & { user?: { uuid: string } }): Promise<PublicCollectionResponse> {
    return this.collectionService.getCollection(code, request.user?.uuid);
  }
}
