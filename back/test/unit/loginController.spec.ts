import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { InvalidLoginInputException, LoginFailedException } from '../../src/common/error/error.customExceptions.js';
import { AllExceptionFilter } from '../../src/common/error/error.filter.js';
import { LoginController } from '../../src/identity/loginController.js';
import { LoginService } from '../../src/identity/loginService.js';

function createController() {
  const loginService = { login: vi.fn().mockResolvedValue({ uuid: 'user-uuid', refreshToken: 'refresh' }) };
  const tokenService = { refresh: vi.fn(), logout: vi.fn() };
  const response = {
    setHeader: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    status: vi.fn(),
  };
  const request = (headers: Record<string, string> = {}, cookie?: string) => ({
    get: (name: string) => headers[name],
    headers: { cookie },
  });
  return {
    controller: new LoginController(loginService as never, tokenService as never),
    loginService,
    tokenService,
    response,
    request,
  };
}

describe('LoginController', () => {
  it('validates request fields and passes the supplied credentials to the service', async () => {
    const { controller, loginService, request, response } = createController();

    await controller.login({ loginId: 'any-user', password: 'provided-password' }, request(), response as never);
    expect(loginService.login).toHaveBeenCalledWith({ loginId: 'any-user', password: 'provided-password' });
  });

  it.each([
    null,
    [],
    {},
    { loginId: '', password: 'password' },
    { loginId: '   ', password: 'password' },
    { loginId: 'a'.repeat(101), password: 'password' },
    { loginId: 123, password: 'password' },
    { loginId: 'admin', password: '' },
    { loginId: 'admin', password: '   ' },
    { loginId: 'admin', password: 123 },
  ])('rejects invalid input %o without calling the service', async (body) => {
    const { controller, loginService, request, response } = createController();

    await expect(controller.login(body, request(), response as never)).rejects.toBeInstanceOf(InvalidLoginInputException);
    expect(loginService.login).not.toHaveBeenCalled();
  });

  it('sets a web refresh cookie and omits the refresh token from JSON', async () => {
    const { controller, request, response } = createController();
    const result = await controller.login(
      { loginId: 'any-user', password: 'provided-password' },
      request({ origin: 'http://localhost:8081', 'x-auth-transport': 'cookie' }),
      response as never,
    );

    expect(result).toEqual({ uuid: 'user-uuid' });
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.cookie).toHaveBeenCalledWith('auth.refreshToken', 'refresh', expect.any(Object));
  });

  it('rejects web mode before calling the login service when the origin is not allowed', async () => {
    const { controller, loginService, request, response } = createController();

    await expect(controller.login(
      { loginId: 'any-user', password: 'provided-password' },
      request({ origin: 'https://other.example', 'x-auth-transport': 'cookie' }),
      response as never,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(loginService.login).not.toHaveBeenCalled();
  });

  it('uses the cookie for web refresh and returns 204 when it is absent', async () => {
    const { controller, request, response, tokenService } = createController();
    const result = await controller.refresh(
      { refreshToken: 'ignored-body-token' },
      request({ origin: 'http://localhost:8081', 'x-auth-transport': 'cookie' }),
      response as never,
    );

    expect(result).toBeUndefined();
    expect(response.status).toHaveBeenCalledWith(204);
    expect(tokenService.refresh).not.toHaveBeenCalled();
  });

  it('registers POST /auth/login with the custom exception filter and HTTP 200', () => {
    expect(Reflect.getMetadata(PATH_METADATA, LoginController)).toBe('auth');
    expect(Reflect.getMetadata(PATH_METADATA, LoginController.prototype.login)).toBe('login');
    expect(Reflect.getMetadata(METHOD_METADATA, LoginController.prototype.login)).toBe(1);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, LoginController.prototype.login)).toBe(200);
    expect(Reflect.getMetadata('__exceptionFilters__', LoginController)).toEqual([AllExceptionFilter]);
  });
});

function createLoginService(result: object | undefined) {
  const query = {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getRawOne: vi.fn().mockResolvedValue(result),
  };
  const repository = { createQueryBuilder: vi.fn().mockReturnValue(query) };
  const tokenService = {
    generateTokens: vi.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', refreshExpiresAt: new Date('2030-01-01T00:00:00Z') }),
    saveRefreshToken: vi.fn().mockResolvedValue(undefined),
  };
  return { service: new LoginService(repository as never, tokenService as never), query, tokenService };
}

describe('LoginService', () => {
  it('checks credentials and active status in one wallet join and returns only the public login data', async () => {
    const row = {
      uuid: 'public-uuid',
      id: 17,
      displayName: 'Admin',
      accountType: 'OPERATOR',
      availablePoints: 42,
    };
    const { service, query, tokenService } = createLoginService(row);

    await expect(service.login({ loginId: 'provided-id', password: 'provided-password' })).resolves.toEqual({
      uuid: row.uuid,
      displayName: row.displayName,
      accountType: row.accountType,
      availablePoints: row.availablePoints,
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    });
    expect(tokenService.generateTokens).toHaveBeenCalledWith(row.uuid);
    expect(tokenService.saveRefreshToken).toHaveBeenCalledWith(17, 'refresh', expect.any(Date));
    expect(query.leftJoin).toHaveBeenCalledTimes(1);
    expect(query.leftJoin.mock.calls[0][2]).toBe('wallet.userId = user.id');
    expect(query.where).toHaveBeenCalledWith('user.loginId = :loginId', { loginId: 'provided-id' });
    expect(query.andWhere).toHaveBeenCalledWith(
      'CAST(user.password AS BINARY) = CAST(:password AS BINARY)',
      { password: 'provided-password' },
    );
    expect(query.andWhere).toHaveBeenCalledWith('user.status = :status', { status: 'ACTIVE' });
    const selectedFields = query.select.mock.calls.concat(query.addSelect.mock.calls).flat();
    expect(selectedFields.join(' ')).not.toContain('password');
    expect(selectedFields.join(' ')).toContain('user.id');
  });

  it.each([null, 0, 17])('normalizes wallet balance %s', async (availablePoints) => {
    const { service } = createLoginService({
      uuid: 'public-uuid',
      id: 17,
      displayName: null,
      accountType: 'MEMBER',
      availablePoints,
    });

    await expect(service.login({ loginId: 'id', password: 'password' })).resolves.toMatchObject({
      availablePoints: availablePoints ?? 0,
    });
  });

  it('uses the same login failure for an unmatched credential result', async () => {
    const { service } = createLoginService(undefined);

    await expect(service.login({ loginId: 'id', password: 'wrong' })).rejects.toBeInstanceOf(LoginFailedException);
  });
});
