import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BaseException } from './error.baseException.js';
import { ErrorCodeEnum } from './error.enum.js';
import type { ErrorResponse } from './error.vo.js';

const httpErrorCodes: Partial<Record<number, ErrorCodeEnum>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCodeEnum.HttpBadRequest,
  [HttpStatus.UNAUTHORIZED]: ErrorCodeEnum.HttpUnauthorized,
  [HttpStatus.FORBIDDEN]: ErrorCodeEnum.HttpForbidden,
  [HttpStatus.NOT_FOUND]: ErrorCodeEnum.HttpNotFound,
  [HttpStatus.CONFLICT]: ErrorCodeEnum.HttpConflict,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCodeEnum.HttpPayloadTooLarge,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ErrorCodeEnum.HttpUnsupportedMediaType,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCodeEnum.HttpUnprocessableEntity,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCodeEnum.HttpServiceUnavailable,
};

function httpErrorStatus(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();

  if (exception !== null && typeof exception === 'object' &&
      'statusCode' in exception && typeof exception.statusCode === 'number' &&
      Number.isInteger(exception.statusCode) && exception.statusCode >= 400 && exception.statusCode <= 599 &&
      'message' in exception && typeof exception.message === 'string') {
    return exception.statusCode;
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = httpErrorStatus(exception);
    const statusName = HttpStatus[statusCode];
    const fallbackName = typeof statusName === 'string' ? statusName : `STATUS_${statusCode}`;

    const body: ErrorResponse = {
      errorCode: exception instanceof BaseException
        ? exception.errorCode
        : statusCode === HttpStatus.INTERNAL_SERVER_ERROR
          ? ErrorCodeEnum.InternalServerError
          : httpErrorCodes[statusCode] ?? `HTTP_${fallbackName}`,
      errorName: exception instanceof BaseException
        ? exception.errorName
        : statusCode === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'InternalServerError'
          : fallbackName,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : 'Unhandled HTTP server error');
    }

    response.status(statusCode).json(body);
  }
}
