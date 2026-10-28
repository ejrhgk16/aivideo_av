import { useCallback } from 'react';
import { useUser } from './UserProvider';
import type { LoginInput } from './login';

export function useLogin() {
  const { login } = useUser();

  return useCallback((input: LoginInput) => login(input), [login]);
}
