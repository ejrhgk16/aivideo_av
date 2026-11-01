export type IBaseException = {
  errorCode: string;
  errorName: string;
  statusCode: number;
};

export type ErrorResponse = IBaseException & {
  timestamp: string;
  path: string;
};
