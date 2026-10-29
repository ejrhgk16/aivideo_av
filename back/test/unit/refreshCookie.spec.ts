import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebCorsOrigins, WEB_CORS_ORIGIN } from '../../src/common/http/webCors.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  usesRefreshCookie,
} from '../../src/identity/refreshCookie.js';
import { InvalidTokenException } from '../../src/common/error/error.customExceptions.js';

const originalOrigins = process.env.WEB_CORS_ORIGINS;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalOrigins === undefined) delete process.env.WEB_CORS_ORIGINS;
  else process.env.WEB_CORS_ORIGINS = originalOrigins;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function request(headers: Record<string, string> = {}, cookie?: string) {
  return {
    get: (name: string) => headers[name],
    headers: { cookie },
  } as never;
}

describe('refresh cookie helpers', () => {
  it('uses the local web origin by default in development and has no production default', () => {
    delete process.env.WEB_CORS_ORIGINS;
    process.env.NODE_ENV = 'development';
    expect(getWebCorsOrigins()).toEqual([WEB_CORS_ORIGIN]);

    process.env.NODE_ENV = 'production';
    expect(getWebCorsOrigins()).toEqual([]);
  });

  it('parses the configured exact origin list and rejects missing or invalid web transport', () => {
    process.env.WEB_CORS_ORIGINS = ' https://app.example.com, ,https://admin.example.com ';
    expect(getWebCorsOrigins()).toEqual(['https://app.example.com', 'https://admin.example.com']);
    expect(usesRefreshCookie(request())).toBe(false);
    expect(() => usesRefreshCookie(request({ origin: 'null', 'x-auth-transport': 'cookie' })))
      .toThrow(ForbiddenException);
    expect(() => usesRefreshCookie(request({ origin: 'https://app.example.com' })))
      .toThrow(ForbiddenException);
    expect(() => usesRefreshCookie(request({ origin: 'https://app.example.com', 'x-auth-transport': 'body' })))
      .toThrow(ForbiddenException);
    expect(usesRefreshCookie(request({ origin: 'https://app.example.com', 'x-auth-transport': 'cookie' })))
      .toBe(true);
  });

  it('distinguishes an absent refresh cookie from an empty or malformed cookie', () => {
    expect(readRefreshCookie(request())).toBeNull();
    expect(readRefreshCookie(request({}, 'other=value'))).toBeNull();
    expect(readRefreshCookie(request({}, 'auth.refreshToken=valid.jwt.value'))).toBe('valid.jwt.value');
    expect(() => readRefreshCookie(request({}, 'auth.refreshToken='))).toThrow(InvalidTokenException);
    expect(() => readRefreshCookie(request({}, 'auth.refreshToken'))).toThrow(InvalidTokenException);
    expect(() => readRefreshCookie(request({}, 'auth.refreshToken=%'))).toThrow(InvalidTokenException);
  });

  it('sets a 14 day HttpOnly cookie and clears it with matching scope', () => {
    process.env.NODE_ENV = 'production';
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };
    const expected = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/auth',
      maxAge: 1209600000,
    };
    setRefreshCookie(response as never, 'opaque');
    expect(response.cookie).toHaveBeenCalledWith('auth.refreshToken', 'opaque', expected);
    clearRefreshCookie(response as never);
    const { maxAge: _maxAge, ...deletionOptions } = expected;
    expect(response.clearCookie).toHaveBeenCalledWith('auth.refreshToken', deletionOptions);

    process.env.NODE_ENV = 'development';
    setRefreshCookie(response as never, 'opaque');
    expect(response.cookie).toHaveBeenLastCalledWith('auth.refreshToken', 'opaque', expect.objectContaining({ secure: false }));
  });
});
