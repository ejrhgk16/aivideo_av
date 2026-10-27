import { HttpException } from '@nestjs/common';
import type { IBaseException } from './error.vo.js';

export class BaseException extends HttpException implements IBaseException {
  constructor(
    readonly errorCode: string,
    readonly errorName: string,
    readonly statusCode: number,
  ) {
    super(errorName, statusCode);
  }
}
