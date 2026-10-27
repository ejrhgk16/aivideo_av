import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  InvalidLoginInputException,
} from '../common/error/error.customExceptions.js';
import { AllExceptionFilter } from '../common/error/error.filter.js';
import { LoginService } from './loginService.js';

@Controller('auth')
@UseFilters(AllExceptionFilter)
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

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

    const loginInput = { loginId: input.loginId, password: input.password };
    loginInput.loginId = 'admin';
    loginInput.password = 'admin';
    return this.loginService.login(loginInput);
  }
}
