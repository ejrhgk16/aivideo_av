import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { parsePage } from '../common/pagination/pagination.js';
import { JwtAuthGuard } from '../identity/jwtAuthGuard.js';
import { WATCH_HISTORY_PAGE_SIZE, WatchHistoryService } from './watchHistoryService.js';
import type { WatchHistoryPageResponse } from './watchHistoryResponses.js';

type AuthenticatedRequest = Request & { user: { uuid: string } };

@Controller('me/watch-history')
@UseGuards(JwtAuthGuard)
export class WatchHistoryController {
  constructor(private readonly watchHistory: WatchHistoryService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('page') rawPage: unknown): Promise<WatchHistoryPageResponse> {
    const page = parsePage(rawPage, WATCH_HISTORY_PAGE_SIZE);
    return this.watchHistory.list(request.user.uuid, page);
  }
}
