import * as SecureStore from 'expo-secure-store';

const key = 'theme.preference';

// 첫 화면을 그리기 전에 읽어야 해서 동기 API를 쓴다.
export const readThemePreference = () => SecureStore.getItem(key);
export const writeThemePreference = (value: string) => SecureStore.setItem(key, value);
