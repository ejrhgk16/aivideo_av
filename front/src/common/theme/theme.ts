import { StyleSheet, useColorScheme } from 'react-native';
import { palettes, type Palette } from '@/common/theme/tokens';

export type ColorSchemeName = keyof typeof palettes;

/** 기기의 화면 모드를 따른다. 앱 안에 따로 저장하는 모드 선택값은 없다. */
export function useColorSchemeName(): ColorSchemeName {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
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
