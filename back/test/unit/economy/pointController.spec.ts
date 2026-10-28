import { NotFoundException } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { PointController } from '../../../src/economy/pointController.js';
import { InvalidPointIncreaseException } from '../../../src/common/error/error.customExceptions.js';
import { AllExceptionFilter } from '../../../src/common/error/error.filter.js';
import { JwtAuthGuard } from '../../../src/identity/jwtAuthGuard.js';

const userUuid = '00000010-0000-4000-8000-000000000001';
const episodeUuid = '00000020-0000-4000-8000-000000000001';

function createController(environment = 'development') {
  const pointService = {
    increase: vi.fn().mockResolvedValue({ uuid: 'transaction-uuid', amount: 10, balanceAfter: 10 }),
    purchaseSingle: vi.fn().mockResolvedValue({ episodeUuid, entitlementUuid: null, chargedPoints: 0, availablePoints: 0 }),
  };
  const configService = { get: vi.fn().mockReturnValue(environment) };
  return { controller: new PointController(configService as never, pointService as never), pointService };
}

describe('PointController', () => {
  it('blocks non-development calls before validating or calling services', () => {
    const { controller, pointService } = createController('production');
    expect(() => controller.increase({ user: { uuid: userUuid } } as never, {})).toThrow(NotFoundException);
    expect(pointService.increase).not.toHaveBeenCalled();
  });

  it('validates the increase body and normalizes an omitted memo', async () => {
    const { controller, pointService } = createController();
    const request = { user: { uuid: userUuid } } as never;
    expect(() => controller.increase(request, {})).toThrow(InvalidPointIncreaseException);
    expect(() => controller.increase(request, { amount: 0, idempotencyKey: 'k' }))
      .toThrow(InvalidPointIncreaseException);
    expect(() => controller.increase(request, { amount: 1, idempotencyKey: '  ' }))
      .toThrow(InvalidPointIncreaseException);

    await controller.increase(request, { amount: 10, idempotencyKey: ' key ' });
    expect(pointService.increase).toHaveBeenCalledWith(userUuid, {
      amount: 10,
      idempotencyKey: ' key ',
      memo: null,
    });
  });

  it('uses the authenticated user for both mutations', async () => {
    const { controller, pointService } = createController();
    const request = { user: { uuid: userUuid } } as never;
    await controller.purchaseSingle(request, 'bad-episode');
    expect(pointService.purchaseSingle).toHaveBeenCalledWith(userUuid, 'bad-episode');
    await controller.increase(request, { amount: 1, idempotencyKey: 'key' });
    expect(pointService.increase).toHaveBeenCalledWith(userUuid, {
      amount: 1, idempotencyKey: 'key', memo: null,
    });
  });

  it('exposes POST paths with explicit 200 status and no generic decrease route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PointController)).toBe('me');
    for (const [name, path] of [
      ['increase', 'points/increase'],
      ['purchaseSingle', 'episodes/:episodeUuid/purchaseSingle'],
    ] as const) {
      const handler = PointController.prototype[name];
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    }
    expect(PointController.prototype).not.toHaveProperty('decrease');
    expect(Reflect.getMetadata('__exceptionFilters__', PointController)).toEqual([
      AllExceptionFilter,
    ]);
    expect(Reflect.getMetadata('__guards__', PointController)).toEqual([JwtAuthGuard]);
  });
});
