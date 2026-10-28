export enum ErrorCodeEnum {
  InvalidLoginInput = 'AUTH_INVALID_LOGIN_INPUT',
  LoginFailed = 'AUTH_LOGIN_FAILED',
  InvalidTokenInput = 'AUTH_INVALID_TOKEN_INPUT',
  InvalidToken = 'AUTH_INVALID_TOKEN',
  PointUserNotFound = 'POINT_USER_NOT_FOUND',
  PointWalletNotFound = 'POINT_WALLET_NOT_FOUND',
  PointEpisodeNotFound = 'POINT_EPISODE_NOT_FOUND',
  InvalidPointIncrease = 'POINT_INVALID_INCREASE',
  PointBalanceOverflow = 'POINT_BALANCE_OVERFLOW',
  PointIdempotencyConflict = 'POINT_IDEMPOTENCY_CONFLICT',
  InsufficientPoints = 'POINT_INSUFFICIENT_BALANCE',
  EpisodeAccessDenied = 'EPISODE_ACCESS_DENIED',
}
