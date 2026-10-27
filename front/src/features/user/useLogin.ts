import { useCallback } from 'react';
import { useUser } from './UserProvider';
import { login, type LoginInput } from './login';

export function useLogin() {
  const { setUser } = useUser();

  return useCallback(async (input: LoginInput) => {
    const response = await login(input);
    const { availablePoints, ...user } = response;
    setUser(user, availablePoints);
    return response;
  }, [setUser]);
}
