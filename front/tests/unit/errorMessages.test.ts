/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { getErrorMessage } from '../../src/common/http/errorMessages';

test('known authentication, episode, and point error codes have Korean messages', () => {
  for (const code of [
    'AUTH_INVALID_LOGIN_INPUT', 'AUTH_LOGIN_FAILED', 'AUTH_INVALID_TOKEN_INPUT', 'AUTH_INVALID_TOKEN',
    'EPISODE_ACCESS_DENIED', 'POINT_INSUFFICIENT_BALANCE', 'POINT_USER_NOT_FOUND', 'POINT_WALLET_NOT_FOUND',
    'POINT_EPISODE_NOT_FOUND', 'POINT_INVALID_INCREASE', 'POINT_BALANCE_OVERFLOW', 'POINT_IDEMPOTENCY_CONFLICT',
  ]) {
    assert.match(getErrorMessage(new ApiError(400, code)), /[가-힣]/);
  }
});

test('unknown error codes, server failures, and network errors use safe fallback messages', () => {
  assert.equal(getErrorMessage(new ApiError(400, 'INTERNAL_SECRET')), '요청 정보를 확인해 주세요.');
  assert.equal(getErrorMessage(new ApiError(401, null)), '로그인이 필요합니다.');
  assert.equal(getErrorMessage(new ApiError(503, null)), '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  assert.equal(getErrorMessage(new Error('database password=private')), '네트워크 연결을 확인하고 다시 시도해 주세요.');
});

test('403 access denial is not described as an expired login', () => {
  assert.equal(getErrorMessage(new ApiError(403, 'EPISODE_ACCESS_DENIED')), '이 회차를 이용할 권한이 없습니다.');
});

test('known business guidance takes priority while HTTP status guides unknown common errors', () => {
  assert.equal(getErrorMessage(new ApiError(401, 'AUTH_INVALID_TOKEN')), '로그인이 만료됐어요. 다시 로그인해 주세요.');
  assert.equal(getErrorMessage(new ApiError(409, 'POINT_INSUFFICIENT_BALANCE')), '보유 포인트가 부족합니다.');
  assert.equal(getErrorMessage(new ApiError(400, 'HTTP_BAD_REQUEST')), '요청 정보를 확인해 주세요.');
  assert.equal(getErrorMessage(new ApiError(401, 'HTTP_UNAUTHORIZED')), '로그인이 필요합니다.');
  assert.equal(getErrorMessage(new ApiError(403, 'HTTP_FORBIDDEN')), '이 요청을 수행할 권한이 없습니다.');
  assert.equal(getErrorMessage(new ApiError(404, 'HTTP_NOT_FOUND')), '요청한 정보를 찾을 수 없습니다.');
  assert.equal(getErrorMessage(new ApiError(409, 'HTTP_CONFLICT')), '요청 상태가 변경됐습니다. 다시 확인해 주세요.');
  assert.equal(getErrorMessage(new ApiError(500, 'INTERNAL_SERVER_ERROR')), '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  assert.equal(getErrorMessage(new ApiError(503, 'HTTP_SERVICE_UNAVAILABLE')), '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  assert.equal(getErrorMessage(new ApiError(503, 'UNKNOWN_CODE')), '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  assert.equal(getErrorMessage(new ApiError(503, 'constructor')), '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  assert.equal(getErrorMessage(new ApiError(404, 'UNKNOWN_CODE')), '요청한 정보를 찾을 수 없습니다.');
  assert.equal(getErrorMessage(new ApiError(418, null)), '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
});
