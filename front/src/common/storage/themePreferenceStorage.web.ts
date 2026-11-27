const key = 'theme.preference';

// 정적 렌더링처럼 localStorage가 없는 환경에서는 저장하지 않는다.
export const readThemePreference = () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key));
export const writeThemePreference = (value: string) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
};
