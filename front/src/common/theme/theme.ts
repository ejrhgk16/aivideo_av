import { createContext, useContext } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { palettes, type Palette } from '@/common/theme/tokens';

export type ColorSchemeName = keyof typeof palettes;
/** 'system'이면 기기 모드를 따르고, 나머지는 앱 안에서 고른 모드다. */
export type ThemePreference = 'system' | ColorSchemeName;

type ThemePreferenceState = { preference: ThemePreference; setPreference: (next: ThemePreference) => void };

// ThemeProvider 밖(부품 단위 테스트 등)에서는 기기 모드를 따르고 선택을 저장하지 않는다.
export const ThemePreferenceContext = createContext<ThemePreferenceState>({ preference: 'system', setPreference: () => {} });

export function useColorSchemeName(): ColorSchemeName {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { preference } = useContext(ThemePreferenceContext);
  return preference === 'system' ? system : preference;
}

/** 지금 보이는 모드의 반대(라이트↔다크)를 골라 저장한다. */
export function useToggleColorScheme(): () => void {
  const scheme = useColorSchemeName();
  const { setPreference } = useContext(ThemePreferenceContext);
  return () => setPreference(scheme === 'dark' ? 'light' : 'dark');
}

export function useColors(): Palette {
  return palettes[useColorSchemeName()];
}

/** 라이트·다크 스타일시트를 모듈을 읽을 때 한 번씩 만들고, 훅은 지금 모드의 것을 돌려준다. */
export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: Palette) => T) {
  const sheets = { light: StyleSheet.create(factory(palettes.light)), dark: StyleSheet.create(factory(palettes.dark)) };
  return function useThemedStyles(): T {
    return sheets[useColorSchemeName()];
  };
}
