import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { InvalidTokenException } from '../../../src/common/error/error.customExceptions.js';
import { JwtAuthGuard } from '../../../src/identity/jwtAuthGuard.js';
import { OptionalJwtAuthGuard } from '../../../src/identity/optionalJwtAuthGuard.js';
import { JwtStrategy } from '../../../src/identity/jwtStrategy.js';

const userUuid = '00000010-0000-4000-8000-000000000001';
const config = { get: (name: string) => name === 'JWT_ACCESS_SECRET' ? 'access-secret' : 'refresh-secret' };

describe('JwtStrategy', () => {
  it('rejects an expired signed Access token in Passport before user lookup', async () => {
    const users = { findOneBy: vi.fn() };
    const strategy = new JwtStrategy(config as never, users as never);
    const token = await new JwtService().signAsync(
      { sub: userUuid, tokenType: 'access' },
      { secret: 'access-secret', algorithm: 'HS256', expiresIn: -1 },
    );
    const outcome = await new Promise<{ kind: string; args?: unknown[] }>((resolve, reject) => {
      const passportStrategy = strategy as unknown as {
        fail: (...args: unknown[]) => void;
        error: (error: Error) => void;
        success: (user: unknown) => void;
      };
      passportStrategy.fail = (...args) => resolve({ kind: 'fail', args });
      passportStrategy.error = reject;
      passportStrategy.success = () => resolve({ kind: 'success' });
      strategy.authenticate(
        { headers: { authorization: `Bearer ${token}` } } as never,
        {},
      );
    });

    expect(outcome.kind).toBe('fail');
    expect(users.findOneBy).not.toHaveBeenCalled();
  });

  it('returns only the uuid for a valid access payload and active user', async () => {
    const users = { findOneBy: vi.fn().mockResolvedValue({ uuid: userUuid }) };
    const strategy = new JwtStrategy(config as never, users as never);

    await expect(strategy.validate({ sub: userUuid, tokenType: 'access', exp: 1900000000 })).resolves.toEqual({ uuid: userUuid });
    expect(users.findOneBy).toHaveBeenCalledWith({ uuid: userUuid, status: 'ACTIVE' });
  });

  it.each([
    { sub: userUuid, tokenType: 'refresh', exp: 1900000000 },
    { sub: 'bad-uuid', tokenType: 'access', exp: 1900000000 },
    { sub: userUuid, tokenType: 'access', exp: 'later' },
  ])('rejects invalid access claims %#', async (payload) => {
    const users = { findOneBy: vi.fn() };
    const strategy = new JwtStrategy(config as never, users as never);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(InvalidTokenException);
    expect(users.findOneBy).not.toHaveBeenCalled();
  });

  it('rejects an inactive or missing user', async () => {
    const strategy = new JwtStrategy(config as never, { findOneBy: vi.fn().mockResolvedValue(null) } as never);

    await expect(strategy.validate({ sub: userUuid, tokenType: 'access', exp: 1900000000 }))
      .rejects.toBeInstanceOf(InvalidTokenException);
  });
});

describe('JwtAuthGuard', () => {
  it('preserves strategy and database errors instead of mapping them to authentication failures', () => {
    const guard = new JwtAuthGuard();
    const databaseError = new Error('database unavailable');

    expect(() => guard.handleRequest(databaseError, null)).toThrow(databaseError);
  });

  it('maps only a missing authenticated user to InvalidTokenException', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.handleRequest(null, null)).toThrow(InvalidTokenException);
    expect(guard.handleRequest(null, { uuid: userUuid })).toEqual({ uuid: userUuid });
  });
});

describe('OptionalJwtAuthGuard', () => {
  it('allows anonymous requests only when Authorization is absent', async () => {
    const guard = new OptionalJwtAuthGuard();
    const context = (authorization?: string) => ({
      switchToHttp: () => ({ getRequest: () => ({ headers: authorization === undefined ? {} : { authorization } }) }),
    }) as never;

    expect(guard.canActivate(context())).toBe(true);
  });

  it('delegates every present Authorization header to JWT validation', async () => {
    const guard = new OptionalJwtAuthGuard();
    const validate = vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    const context = (authorization: string) => ({
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
    }) as never;

    await expect(guard.canActivate(context(''))).resolves.toBe(true);
    await expect(guard.canActivate(context('Basic invalid'))).resolves.toBe(true);
    expect(validate).toHaveBeenCalledTimes(2);
    validate.mockRestore();
  });
});
