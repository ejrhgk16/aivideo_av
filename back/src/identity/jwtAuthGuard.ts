import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvalidTokenException } from '../common/error/error.customExceptions.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = { uuid: string }>(
    err: unknown,
    user: TUser | null,
  ): TUser {
    if (err) throw err;
    if (!user) throw new InvalidTokenException();
    return user;
  }
}
