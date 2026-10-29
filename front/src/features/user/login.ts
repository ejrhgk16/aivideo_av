import { publicApiRequest } from '../../common/http/api';

export interface LoginInput {
  loginId: string;
  password: string;
}

export type LoginResponse = {
  uuid: string;
  displayName: string | null;
  accountType: 'GUEST' | 'MEMBER' | 'OPERATOR' | 'PARTNER';
  availablePoints: number;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
};

export type RefreshTransport = 'body' | 'cookie';

export function login(input: LoginInput, fetcher?: typeof fetch, transport: RefreshTransport = 'body'): Promise<LoginResponse> {
  return publicApiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    json: input,
    ...(transport === 'cookie' ? { credentials: 'include', headers: { 'X-Auth-Transport': 'cookie' } } : {}),
  }, fetcher);
}
