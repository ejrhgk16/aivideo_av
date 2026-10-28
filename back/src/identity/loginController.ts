import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  InvalidTokenInputException,
  InvalidLoginInputException,
} from '../common/error/error.customExceptions.js';
import { AllExceptionFilter } from '../common/error/error.filter.js';
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
  login(@Body() body: unknown) {
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

    return this.loginService.login({ loginId: input.loginId, password: input.password });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown) {
    return this.tokenService.refresh(this.readRefreshToken(body));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: unknown): Promise<void> {
    await this.tokenService.logout(this.readRefreshToken(body));
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
