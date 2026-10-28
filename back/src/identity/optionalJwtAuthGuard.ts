import { Injectable, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwtAuthGuard.js';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.authorization === undefined) return true;
    return super.canActivate(context);
  }
}
