import { publicApiRequest } from '../../common/http/api';
import type { LoginResponse } from './userResponses';

export type { LoginResponse } from './userResponses';

export interface LoginInput {
  loginId: string;
  password: string;
}

export type RefreshTransport = 'body' | 'cookie';

export function login(input: LoginInput, fetcher?: typeof fetch, transport: RefreshTransport = 'body'): Promise<LoginResponse> {
  return publicApiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    json: input,
    ...(transport === 'cookie' ? { credentials: 'include', headers: { 'X-Auth-Transport': 'cookie' } } : {}),
  }, fetcher);
}
