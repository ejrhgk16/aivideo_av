import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PointService, type IncreasePointsInput } from './pointService.js';
import { InvalidPointIncreaseException } from '../common/error/error.customExceptions.js';
import { AllExceptionFilter } from '../common/error/error.filter.js';

@Controller('users/:userUuid')
@UseFilters(AllExceptionFilter)
export class PointController {
  constructor(
    private readonly configService: ConfigService,
    private readonly pointService: PointService,
  ) {}

  @Post('points/increase')
  @HttpCode(200)
  increase(@Param('userUuid') userUuid: string, @Body() body: unknown) {
    this.assertDevelopment();
    return this.pointService.increase(userUuid, this.parseIncreaseInput(body));
  }

  @Post('episodes/:episodeUuid/purchaseSingle')
  @HttpCode(200)
  purchaseSingle(
    @Param('userUuid') userUuid: string,
    @Param('episodeUuid') episodeUuid: string,
  ) {
    this.assertDevelopment();
    return this.pointService.purchaseSingle(userUuid, episodeUuid);
  }

  private assertDevelopment(): void {
    if ((this.configService.get<string>('NODE_ENV') ?? 'development') !== 'development') {
      throw new NotFoundException();
    }
  }

  private parseIncreaseInput(body: unknown): IncreasePointsInput {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new InvalidPointIncreaseException();
    }

    const input = body as Record<string, unknown>;
    if (
      !Number.isInteger(input.amount) ||
      (input.amount as number) < 1 ||
      (input.amount as number) > 2147483647 ||
      typeof input.idempotencyKey !== 'string' ||
      input.idempotencyKey.length < 1 ||
      input.idempotencyKey.length > 100 ||
      input.idempotencyKey.trim().length === 0 ||
      (input.memo !== undefined &&
        (typeof input.memo !== 'string' || input.memo.length > 300))
    ) {
      throw new InvalidPointIncreaseException();
    }

    return {
      amount: input.amount as number,
      idempotencyKey: input.idempotencyKey,
      memo: (input.memo as string | undefined) ?? null,
    };
  }
}
