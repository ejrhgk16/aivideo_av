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
  refreshToken: string;
  expiresIn: number;
};

export class AuthRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to log in.');
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new AuthRequestError(`Failed to log in: ${response.status}`, response.status);
  }

  return (await response.json()) as LoginResponse;
}
