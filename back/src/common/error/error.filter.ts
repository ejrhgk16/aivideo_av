import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BaseException } from './error.baseException.js';

@Catch(BaseException)
export class AllExceptionFilter implements ExceptionFilter<BaseException> {
  catch(exception: BaseException, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    response.status(exception.statusCode).json({
      errorCode: exception.errorCode,
      errorName: exception.errorName,
      statusCode: exception.statusCode,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    });
  }
}
