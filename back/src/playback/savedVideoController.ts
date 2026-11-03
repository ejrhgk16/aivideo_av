import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { parsePage } from '../common/pagination/pagination.js';
import { JwtAuthGuard } from '../identity/jwtAuthGuard.js';
import { SAVED_VIDEO_PAGE_SIZE, SavedVideoService } from './savedVideoService.js';
import type { SavedVideoPageResponse } from './savedVideoResponses.js';

type AuthenticatedRequest = Request & { user: { uuid: string } };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('me/saved-videos')
@UseGuards(JwtAuthGuard)
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
  list(@Req() request: AuthenticatedRequest, @Query('page') rawPage: unknown): Promise<SavedVideoPageResponse> {
    const page = parsePage(rawPage, SAVED_VIDEO_PAGE_SIZE);
    return this.savedVideos.list(request.user.uuid, page);
  }
}
