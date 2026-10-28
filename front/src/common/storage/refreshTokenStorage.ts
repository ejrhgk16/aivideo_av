import * as SecureStore from 'expo-secure-store';

const key = 'auth.refreshToken';

export const readRefreshToken = () => SecureStore.getItemAsync(key);
export const writeRefreshToken = (token: string) => SecureStore.setItemAsync(key, token);
export const removeRefreshToken = () => SecureStore.deleteItemAsync(key);
