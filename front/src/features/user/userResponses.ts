export type LoginResponse = {
  uuid: string;
  displayName: string | null;
  accountType: 'GUEST' | 'MEMBER' | 'OPERATOR' | 'PARTNER';
  availablePoints: number;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
};
