import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { InvalidTokenException } from '../../../src/common/error/error.customExceptions.js';
import { AuthSession, RefreshToken, User } from '../../../src/identity/entities/index.js';
import { TokenService } from '../../../src/identity/tokenService.js';
import { Wallet } from '../../../src/economy/entities/index.js';

const accessSecret = 'access-key-with-sufficient-development-entropy-0123456789';
const refreshSecret = 'refresh-key-with-sufficient-development-entropy-9876543210';
const userUuid = '00000010-0000-4000-8000-000000000001';

function setup(options: { usedAt?: Date | null; revokedAt?: Date | null; expiresAt?: Date } = {}) {
  const jwt = new JwtService();
  const session = { id: 7, userId: 11, revokedAt: options.revokedAt ?? null, updatedAt: new Date() };
  const stored = {
    id: 15,
    authSessionId: session.id,
    tokenHash: 'stored-hash',
    expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000),
    usedAt: options.usedAt ?? null,
    updatedAt: new Date(),
  };
  const lockOrder: string[] = [];
  let committed = false;
  const sessionQuery = {
    where: vi.fn().mockReturnThis(),
    setLock: vi.fn(() => { lockOrder.push('session'); return sessionQuery; }),
    getOne: vi.fn().mockResolvedValue(session),
  };
  const tokenQuery = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    setLock: vi.fn(() => { lockOrder.push('token'); return tokenQuery; }),
    getOne: vi.fn().mockResolvedValue(stored),
  };
  const sessionRepo = {
    createQueryBuilder: vi.fn().mockReturnValue(sessionQuery),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => value),
  };
  const tokenRepo = {
    createQueryBuilder: vi.fn().mockReturnValue(tokenQuery),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => value),
  };
  const user = { id: 11, uuid: userUuid, status: 'ACTIVE', displayName: 'Admin', accountType: 'OPERATOR' };
  const userRepo = { findOneBy: vi.fn().mockResolvedValue(user) };
  const walletRepo = { findOneBy: vi.fn().mockResolvedValue({ availablePoints: 23 }) };
  const repositories = new Map([
    [AuthSession, sessionRepo],
    [RefreshToken, tokenRepo],
    [User, userRepo],
    [Wallet, walletRepo],
  ]);
  const manager = { getRepository: vi.fn((entity) => repositories.get(entity) as never) };
  const dataSource = {
    transaction: vi.fn(async (operation) => {
      const result = await operation(manager as never);
      committed = true;
      return result;
    }),
  };
  const refreshTokens = {
    findOneBy: vi.fn().mockResolvedValue({ id: stored.id, authSessionId: session.id }),
  };
  const config = { get: (name: string) => name === 'JWT_ACCESS_SECRET' ? accessSecret : refreshSecret };
  const service = new TokenService(jwt, config as never, dataSource as never, refreshTokens as never);
  return {
    jwt, service, session, stored, user, sessionRepo, tokenRepo, tokenQuery, userRepo, walletRepo,
    refreshTokens, dataSource, lockOrder, committed: () => committed,
  };
}

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

describe('TokenService', () => {
  it('issues separate access and refresh tokens with fixed lifetimes and unique refresh jti values', async () => {
    const { service, jwt } = setup();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T10:00:00.000Z'));
    let generated: Awaited<ReturnType<typeof service.generateTokens>>[];
    try {
      generated = await Promise.all([
        service.generateTokens(userUuid),
        service.generateTokens(userUuid),
      ]);
    } finally {
      vi.useRealTimers();
    }
    const [first, second] = generated;
    const firstAccess = jwt.decode(first.accessToken) as { tokenType: string; exp: number; sub: string };
    const firstRefresh = jwt.decode(first.refreshToken) as { tokenType: string; exp: number; iat: number; jti: string; sub: string };
    const secondRefresh = jwt.decode(second.refreshToken) as { jti: string };

    expect(firstAccess).toMatchObject({ sub: userUuid, tokenType: 'access' });
    expect(firstAccess.exp - (jwt.decode(first.accessToken) as { iat: number }).iat).toBe(900);
    expect(firstRefresh).toMatchObject({ sub: userUuid, tokenType: 'refresh' });
    expect(firstRefresh.iat).toBe((jwt.decode(second.refreshToken) as { iat: number }).iat);
    expect(firstRefresh.exp - firstRefresh.iat).toBe(1209600);
    expect(firstRefresh.jti).not.toBe(secondRefresh.jti);
    expect(first.refreshExpiresAt).toEqual(new Date(firstRefresh.exp * 1000));
  });

  it('rotates by locking session before token and appending a hash without storing the raw token', async () => {
    const state = setup();
    const old = await state.service.generateTokens(userUuid);
    state.refreshTokens.findOneBy.mockResolvedValue({ id: state.stored.id, authSessionId: state.session.id });
    const response = await state.service.refresh(old.refreshToken);

    expect(state.lockOrder).toEqual(['session', 'token']);
    expect(state.stored.usedAt).toBeInstanceOf(Date);
    expect(state.tokenRepo.save).toHaveBeenCalledTimes(2);
    expect(state.tokenRepo.save.mock.calls[1][0]).toMatchObject({
      authSessionId: state.session.id,
      tokenHash: hash(response.refreshToken),
      usedAt: null,
    });
    expect(state.tokenRepo.save.mock.calls[1][0].tokenHash).not.toBe(response.refreshToken);
    expect(response).toMatchObject({ uuid: userUuid, availablePoints: 23, expiresIn: 900 });
    expect(state.committed()).toBe(true);
  });

  it('commits session revocation before rejecting a used expired refresh token replay', async () => {
    const state = setup({ usedAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() - 1000) });
    const expired = await state.jwt.signAsync(
      { sub: userUuid, tokenType: 'refresh' },
      { secret: refreshSecret, algorithm: 'HS256', expiresIn: -1, jwtid: randomUUID() },
    );

    const latest = await state.jwt.signAsync(
      { sub: userUuid, tokenType: 'refresh' },
      { secret: refreshSecret, algorithm: 'HS256', expiresIn: 1209600, jwtid: randomUUID() },
    );
    const latestStored = { ...state.stored, id: 16, usedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    state.tokenQuery.getOne.mockResolvedValueOnce(state.stored).mockResolvedValueOnce(latestStored);
    state.refreshTokens.findOneBy.mockResolvedValueOnce({ id: state.stored.id, authSessionId: state.session.id })
      .mockResolvedValueOnce({ id: latestStored.id, authSessionId: state.session.id });

    await expect(state.service.refresh(expired)).rejects.toBeInstanceOf(InvalidTokenException);
    await expect(state.service.refresh(latest)).rejects.toBeInstanceOf(InvalidTokenException);
    expect(state.lockOrder).toEqual(['session', 'token', 'session', 'token']);
    expect(state.session.revokedAt).toBeInstanceOf(Date);
    expect(state.sessionRepo.save).toHaveBeenCalled();
    expect(state.tokenRepo.save).not.toHaveBeenCalled();
    expect(state.committed()).toBe(true);
  });

  it('does not rotate an expired unused token', async () => {
    const state = setup({ expiresAt: new Date(Date.now() - 1000) });
    const expired = await state.jwt.signAsync(
      { sub: userUuid, tokenType: 'refresh' },
      { secret: refreshSecret, algorithm: 'HS256', expiresIn: -1, jwtid: randomUUID() },
    );

    await expect(state.service.refresh(expired)).rejects.toBeInstanceOf(InvalidTokenException);
    expect(state.stored.usedAt).toBeNull();
    expect(state.sessionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a validly signed refresh token that has no stored hash history', async () => {
    const state = setup();
    const token = await state.service.generateTokens(userUuid);
    state.refreshTokens.findOneBy.mockResolvedValue(null);

    await expect(state.service.refresh(token.refreshToken)).rejects.toBeInstanceOf(InvalidTokenException);
    expect(state.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('propagates database failures during refresh without converting them to 401', async () => {
    const state = setup();
    const token = await state.service.generateTokens(userUuid);
    const databaseError = new Error('database unavailable');
    state.userRepo.findOneBy.mockRejectedValue(databaseError);

    await expect(state.service.refresh(token.refreshToken)).rejects.toBe(databaseError);
    expect(state.lockOrder).toEqual(['session', 'token']);
    expect(state.committed()).toBe(false);
  });

  it.each([
    ['invalid signature', 'not-a-jwt'],
    ['wrong token purpose', 'access'],
  ])('rejects %s before using token history', async (_, kind) => {
    const state = setup();
    const token = kind === 'access'
      ? await state.jwt.signAsync(
        { sub: userUuid, tokenType: 'access' },
        { secret: refreshSecret, algorithm: 'HS256', expiresIn: 900 },
      )
      : String(kind);

    await expect(state.service.refresh(token)).rejects.toBeInstanceOf(InvalidTokenException);
    expect(state.refreshTokens.findOneBy).not.toHaveBeenCalled();
  });

  it('requires distinct non-empty signing keys at construction', () => {
    const { jwt, dataSource, refreshTokens } = setup();
    expect(() => new TokenService(
      jwt,
      { get: () => 'same-key' } as never,
      dataSource as never,
      refreshTokens as never,
    )).toThrow(/distinct non-empty/);
  });
});
