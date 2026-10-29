import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InvalidTokenException } from '../common/error/error.customExceptions.js';
import { getWebCorsOrigins } from '../common/http/webCors.js';

export const refreshCookieName = 'auth.refreshToken';
const refreshCookiePath = '/auth';
const refreshCookieLifetime = 1209600;

export function usesRefreshCookie(request: Request): boolean {
  const origin = request.get('origin');
  const transport = request.get('x-auth-transport');
  if (origin === undefined && transport === undefined) return false;
  if (transport !== 'cookie' || origin === undefined || !getWebCorsOrigins().includes(origin)) {
    throw new ForbiddenException();
  }
  return true;
}

export function readRefreshCookie(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (cookieHeader === undefined) return null;
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part === refreshCookieName || part.startsWith(`${refreshCookieName}=`));
  if (cookie === undefined) return null;
  if (!cookie.startsWith(`${refreshCookieName}=`)) throw new InvalidTokenException();
  try {
    const value = decodeURIComponent(cookie.slice(refreshCookieName.length + 1));
    if (!value.trim()) throw new InvalidTokenException();
    return value;
  } catch {
    throw new InvalidTokenException();
  }
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: refreshCookiePath,
    maxAge: refreshCookieLifetime * 1000,
  };
}

export function setRefreshCookie(response: Response, refreshToken: string): void {
  response.cookie(refreshCookieName, refreshToken, refreshCookieOptions());
}

export function clearRefreshCookie(response: Response): void {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  response.clearCookie(refreshCookieName, options);
}

export function webSession<T extends { refreshToken: string }>(session: T, response: Response) {
  setRefreshCookie(response, session.refreshToken);
  const { refreshToken: _refreshToken, ...publicSession } = session;
  return publicSession;
}
