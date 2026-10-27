import type { User } from './UserProvider';

export interface LoginInput {
  loginId: string;
  password: string;
}

export type LoginResponse = User & { availablePoints: number };

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
    throw new Error(`Failed to log in: ${response.status}`);
  }

  return (await response.json()) as LoginResponse;
}
