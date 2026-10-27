import { HttpStatus } from '@nestjs/common';
import { BaseException } from './error.baseException.js';
import { ErrorCodeEnum } from './error.enum.js';

export class InvalidLoginInputException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.InvalidLoginInput, 'InvalidLoginInput', HttpStatus.BAD_REQUEST);
  }
}

export class LoginFailedException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.LoginFailed, 'LoginFailed', HttpStatus.UNAUTHORIZED);
  }
}

export class PointUserNotFoundException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.PointUserNotFound, 'PointUserNotFound', HttpStatus.NOT_FOUND);
  }
}

export class PointWalletNotFoundException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.PointWalletNotFound, 'PointWalletNotFound', HttpStatus.NOT_FOUND);
  }
}

export class PointEpisodeNotFoundException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.PointEpisodeNotFound, 'PointEpisodeNotFound', HttpStatus.NOT_FOUND);
  }
}

export class InvalidPointIncreaseException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.InvalidPointIncrease, 'InvalidPointIncrease', HttpStatus.BAD_REQUEST);
  }
}

export class PointBalanceOverflowException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.PointBalanceOverflow, 'PointBalanceOverflow', HttpStatus.BAD_REQUEST);
  }
}

export class PointIdempotencyConflictException extends BaseException {
  constructor() {
    super(
      ErrorCodeEnum.PointIdempotencyConflict,
      'PointIdempotencyConflict',
      HttpStatus.CONFLICT,
    );
  }
}

export class InsufficientPointsException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.InsufficientPoints, 'InsufficientPoints', HttpStatus.CONFLICT);
  }
}
