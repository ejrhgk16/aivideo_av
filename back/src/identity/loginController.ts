import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  InvalidTokenException,
  InvalidTokenInputException,
  InvalidLoginInputException,
} from '../common/error/error.customExceptions.js';
import { AllExceptionFilter } from '../common/error/error.filter.js';
import { clearRefreshCookie, readRefreshCookie, usesRefreshCookie, webSession } from './refreshCookie.js';
import { LoginService } from './loginService.js';
import { TokenService } from './tokenService.js';

@Controller('auth')
@UseFilters(AllExceptionFilter)
export class LoginController {
  constructor(
    private readonly loginService: LoginService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const cookieMode = usesRefreshCookie(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new InvalidLoginInputException();
    }

    const input = body as Record<string, unknown>;
    if (
      typeof input.loginId !== 'string' ||
      !input.loginId.trim() ||
      input.loginId.length > 100 ||
      typeof input.password !== 'string' ||
      !input.password.trim()
    ) {
      throw new InvalidLoginInputException();
    }

    const session = await this.loginService.login({ loginId: input.loginId, password: input.password });
    return cookieMode ? webSession(session, response) : session;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    if (!usesRefreshCookie(request)) return this.tokenService.refresh(this.readRefreshToken(body));
    try {
      const refreshToken = readRefreshCookie(request);
      if (refreshToken === null) {
        response.status(HttpStatus.NO_CONTENT);
        return;
      }
      return webSession(await this.tokenService.refresh(refreshToken), response);
    } catch (error) {
      if (error instanceof InvalidTokenException) clearRefreshCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    if (!usesRefreshCookie(request)) {
      await this.tokenService.logout(this.readRefreshToken(body));
      return;
    }
    try {
      const refreshToken = readRefreshCookie(request);
      if (refreshToken !== null) await this.tokenService.logout(refreshToken);
    } finally {
      clearRefreshCookie(response);
    }
  }

  private readRefreshToken(body: unknown): string {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new InvalidTokenInputException();
    }
    const refreshToken = (body as Record<string, unknown>).refreshToken;
    if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
      throw new InvalidTokenInputException();
    }
    return refreshToken;
  }
}
