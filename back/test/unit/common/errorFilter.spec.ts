import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BaseException } from '../../../src/common/error/error.baseException.js';
import { ErrorCodeEnum } from '../../../src/common/error/error.enum.js';
import { AllExceptionFilter } from '../../../src/common/error/error.filter.js';

function invokeFilter(exception: unknown, path = '/items?sort=invalid') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const request = { originalUrl: path, url: path };
  const response = { status };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionFilter().catch(exception, host);

  return { status, json };
}

describe('AllExceptionFilter', () => {
  it.each([
    [HttpStatus.BAD_REQUEST, 'HTTP_BAD_REQUEST', 'BAD_REQUEST'],
    [HttpStatus.UNAUTHORIZED, 'HTTP_UNAUTHORIZED', 'UNAUTHORIZED'],
    [HttpStatus.FORBIDDEN, 'HTTP_FORBIDDEN', 'FORBIDDEN'],
    [HttpStatus.NOT_FOUND, 'HTTP_NOT_FOUND', 'NOT_FOUND'],
    [HttpStatus.CONFLICT, 'HTTP_CONFLICT', 'CONFLICT'],
    [HttpStatus.PAYLOAD_TOO_LARGE, 'HTTP_PAYLOAD_TOO_LARGE', 'PAYLOAD_TOO_LARGE'],
    [HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'HTTP_UNSUPPORTED_MEDIA_TYPE', 'UNSUPPORTED_MEDIA_TYPE'],
  ])('maps HttpException %i to the shared contract', (statusCode, errorCode, errorName) => {
    const { status, json } = invokeFilter(new HttpException('private details', statusCode));

    expect(status).toHaveBeenCalledWith(statusCode);
    expect(json).toHaveBeenCalledOnce();
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({ errorCode, errorName, statusCode, path: '/items?sort=invalid' });
    expect(Object.keys(body).sort()).toEqual(['errorCode', 'errorName', 'path', 'statusCode', 'timestamp']);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    expect(body).not.toHaveProperty('message');
  });

  it('preserves business fields and request path', () => {
    const error = new BaseException(ErrorCodeEnum.InvalidToken, 'InvalidToken', HttpStatus.UNAUTHORIZED);
    const { status, json } = invokeFilter(error, '/auth/refresh?client=native');

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json.mock.calls[0][0]).toMatchObject({
      errorCode: ErrorCodeEnum.InvalidToken,
      errorName: 'InvalidToken',
      statusCode: HttpStatus.UNAUTHORIZED,
      path: '/auth/refresh?client=native',
    });
  });

  it('preserves parser errors with a valid statusCode and message', () => {
    const { status, json } = invokeFilter({
      type: 'entity.parse.failed',
      status: HttpStatus.BAD_REQUEST,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Unexpected token in body',
    }, '/auth/login');

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json.mock.calls[0][0]).toMatchObject({
      errorCode: ErrorCodeEnum.HttpBadRequest,
      errorName: 'BAD_REQUEST',
      statusCode: HttpStatus.BAD_REQUEST,
      path: '/auth/login',
    });

    const tooLarge = invokeFilter({
      type: 'entity.too.large',
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'request body too large',
    }, '/auth/login');
    expect(tooLarge.status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(tooLarge.json.mock.calls[0][0]).toMatchObject({
      errorCode: ErrorCodeEnum.HttpPayloadTooLarge,
      errorName: 'PAYLOAD_TOO_LARGE',
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      path: '/auth/login',
    });
  });

  it('preserves explicit 503 errors and maps statuses outside HttpStatus', () => {
    const loggerError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const internalServerError = invokeFilter(new HttpException('private error details', HttpStatus.INTERNAL_SERVER_ERROR));
    expect(internalServerError.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(internalServerError.json.mock.calls[0][0]).toMatchObject({
      errorCode: ErrorCodeEnum.InternalServerError,
      errorName: 'InternalServerError',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
    expect(JSON.stringify(internalServerError.json.mock.calls[0][0])).not.toContain('private error details');

    const serviceUnavailable = invokeFilter(new HttpException('unavailable', HttpStatus.SERVICE_UNAVAILABLE));
    expect(serviceUnavailable.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(serviceUnavailable.json.mock.calls[0][0]).toMatchObject({
      errorCode: ErrorCodeEnum.HttpServiceUnavailable,
      errorName: 'SERVICE_UNAVAILABLE',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    });

    const unknownStatus = invokeFilter(new HttpException('unknown status', 499));
    expect(unknownStatus.status).toHaveBeenCalledWith(499);
    expect(unknownStatus.json.mock.calls[0][0]).toMatchObject({
      errorCode: 'HTTP_STATUS_499',
      errorName: 'STATUS_499',
      statusCode: 499,
    });
    expect(loggerError).toHaveBeenCalledTimes(2);
    loggerError.mockRestore();
  });

  it('normalizes unknown errors without exposing their message or stack', () => {
    const loggerError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const error = new Error('secret SQL and request contents');
    const { status, json } = invokeFilter(error);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json.mock.calls[0][0]).toMatchObject({
      errorCode: ErrorCodeEnum.InternalServerError,
      errorName: 'InternalServerError',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
    expect(Object.keys(json.mock.calls[0][0]).sort()).toEqual([
      'errorCode', 'errorName', 'path', 'statusCode', 'timestamp',
    ]);
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('secret');
    expect(loggerError).toHaveBeenCalledOnce();
    loggerError.mockRestore();
  });
});
