export type SessionFields = {
  uuid: string;
  displayName: string | null;
  accountType: string;
  availablePoints: number;
  accessToken: string;
  expiresIn: number;
};

export type NativeSessionResponse = SessionFields & {
  refreshToken: string;
};

export type WebSessionResponse = Omit<NativeSessionResponse, 'refreshToken'>;
