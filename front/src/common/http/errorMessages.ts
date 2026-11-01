import { ApiError } from './api';

const messages: Record<string, string> = {
  AUTH_INVALID_LOGIN_INPUT: '로그인 정보를 확인해 주세요.',
  AUTH_LOGIN_FAILED: '아이디 또는 비밀번호를 확인해 주세요.',
  AUTH_INVALID_TOKEN_INPUT: '인증 요청을 확인해 주세요.',
  AUTH_INVALID_TOKEN: '로그인이 만료됐어요. 다시 로그인해 주세요.',
  EPISODE_ACCESS_DENIED: '이 회차를 이용할 권한이 없습니다.',
  POINT_INSUFFICIENT_BALANCE: '보유 포인트가 부족합니다.',
  POINT_USER_NOT_FOUND: '사용자 정보를 찾을 수 없습니다.',
  POINT_WALLET_NOT_FOUND: '포인트 지갑을 찾을 수 없습니다.',
  POINT_EPISODE_NOT_FOUND: '회차 정보를 찾을 수 없습니다.',
  POINT_INVALID_INCREASE: '포인트 지급 값을 확인해 주세요.',
  POINT_BALANCE_OVERFLOW: '포인트 한도를 초과했습니다.',
  POINT_IDEMPOTENCY_CONFLICT: '요청이 이미 처리 중입니다. 잠시 후 다시 시도해 주세요.',
};

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '네트워크 연결을 확인하고 다시 시도해 주세요.';
  const known = error.errorCode === null ? undefined : messages[error.errorCode];
  if (typeof known === 'string') return known;
  if (error.status >= 500) return '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  switch (error.status) {
    case 400: return '요청 정보를 확인해 주세요.';
    case 401: return '로그인이 필요합니다.';
    case 403: return '이 요청을 수행할 권한이 없습니다.';
    case 404: return '요청한 정보를 찾을 수 없습니다.';
    case 409: return '요청 상태가 변경됐습니다. 다시 확인해 주세요.';
    default: return '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
  }
}
