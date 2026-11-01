import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Put, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AllExceptionFilter } from '../common/error/error.filter.js';
import { JwtAuthGuard } from '../identity/jwtAuthGuard.js';
import { SavedVideoService } from './savedVideoService.js';

type AuthenticatedRequest = Request & { user: { uuid: string } };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('me/saved-videos')
@UseGuards(JwtAuthGuard)
@UseFilters(AllExceptionFilter)
export class SavedVideoController {
  constructor(private readonly savedVideos: SavedVideoService) {}

  @Put(':videoUuid')
  @HttpCode(204)
  async save(
    @Req() request: AuthenticatedRequest,
    @Param('videoUuid') videoUuid: string,
    @Body() body: unknown,
  ): Promise<void> {
    if (!uuidPattern.test(videoUuid) || !body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Invalid saved video');
    }
    const { contentType } = body as Record<string, unknown>;
    if (contentType !== 'EPISODE' && contentType !== 'PREVIEW') {
      throw new BadRequestException('Invalid contentType');
    }
    await this.savedVideos.save(request.user.uuid, videoUuid, contentType);
  }

  @Delete(':videoUuid')
  @HttpCode(204)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('videoUuid') videoUuid: string,
  ): Promise<void> {
    if (!uuidPattern.test(videoUuid)) {
      throw new BadRequestException('Invalid saved video');
    }
    await this.savedVideos.remove(request.user.uuid, videoUuid);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('page') rawPage: unknown) {
    const page = rawPage === undefined
      ? 1
      : typeof rawPage === 'string' && /^[1-9][0-9]*$/.test(rawPage) ? Number(rawPage) : NaN;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * 30 + 31)) {
      throw new BadRequestException('Invalid page');
    }
    return this.savedVideos.list(request.user.uuid, page);
  }
}
