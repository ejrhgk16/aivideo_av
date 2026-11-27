import { useMemo, useState, type ReactNode } from 'react';
import { readThemePreference, writeThemePreference } from '@/common/storage/themePreferenceStorage';
import { ThemePreferenceContext, type ThemePreference } from '@/common/theme/theme';

// 저장소를 읽지 못하면 기기 모드를 따르고, 쓰지 못하면 이번 실행 동안만 유지한다. 화면 모드는 실패해도 앱 이용을 막지 않는다.
function readInitialPreference(): ThemePreference {
  try {
    const saved = readThemePreference();
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/** 앱 안 화면 모드 선택을 소유한다. 첫 렌더 전에 동기로 읽어 기기 모드가 잠깐 비치지 않게 한다. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readInitialPreference);
  const value = useMemo(() => ({
    preference,
    setPreference(next: ThemePreference) {
      setPreferenceState(next);
      try {
        writeThemePreference(next);
      } catch {
        // 위 주석 참고: 저장 실패는 이번 실행의 선택만 남긴다.
      }
    },
  }), [preference]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}
