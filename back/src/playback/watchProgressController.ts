import { BadRequestException, Body, Controller, HttpCode, Param, Put, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AllExceptionFilter } from '../common/error/error.filter.js';
import { JwtAuthGuard } from '../identity/jwtAuthGuard.js';
import { WatchProgressService } from './watchProgressService.js';

type AuthenticatedRequest = Request & { user: { uuid: string } };
type WatchProgressInput = { event: 'STARTED' | 'COMPLETED'; positionMs: number };

@Controller('me')
@UseFilters(AllExceptionFilter)
@UseGuards(JwtAuthGuard)
export class WatchProgressController {
  constructor(private readonly watchProgressService: WatchProgressService) {}

  @Put('episodes/:episodeUuid/watch-progress')
  @HttpCode(204)
  async save(
    @Req() request: AuthenticatedRequest,
    @Param('episodeUuid') episodeUuid: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.watchProgressService.save(request.user.uuid, episodeUuid, this.parseInput(body));
  }

  private parseInput(body: unknown): WatchProgressInput {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Invalid watch progress');
    }

    const input = body as Record<string, unknown>;
    if (
      (input.event !== 'STARTED' && input.event !== 'COMPLETED') ||
      !Number.isInteger(input.positionMs) ||
      (input.positionMs as number) < 0 ||
      (input.positionMs as number) > 2147483647 ||
      (input.event === 'STARTED' && input.positionMs !== 0)
    ) {
      throw new BadRequestException('Invalid watch progress');
    }

    return { event: input.event, positionMs: input.positionMs as number };
  }
}
