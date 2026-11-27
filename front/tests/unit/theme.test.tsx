import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { palettes } from '@/common/theme/tokens';
import { createThemedStyles, useColors, useColorSchemeName } from '@/common/theme/theme';
import { AppText, Button, EmptyState, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { ThemeProvider } from '@/common/theme/ThemeProvider';
import { readThemePreference, writeThemePreference } from '@/common/storage/themePreferenceStorage';
import { useUser } from '@/features/user/UserProvider';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));
jest.mock('@/common/storage/themePreferenceStorage', () => ({ readThemePreference: jest.fn(), writeThemePreference: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn(), push: jest.fn() }) }));

const scheme = jest.mocked(useColorScheme);

beforeEach(() => {
  scheme.mockReturnValue('light');
  jest.mocked(useUser).mockReturnValue({ points: 1200 } as ReturnType<typeof useUser>);
});

describe('화면 모드 훅', () => {
  test('기기 모드가 다크면 먹색 팔레트, 그 밖(라이트·정하지 않음)은 크림 팔레트를 쓴다', () => {
    scheme.mockReturnValue('dark');
    expect(renderHook(() => useColors()).result.current).toBe(palettes.dark);
    expect(renderHook(() => useColorSchemeName()).result.current).toBe('dark');

    scheme.mockReturnValue('unspecified');
    expect(renderHook(() => useColors()).result.current).toBe(palettes.light);
    expect(palettes.light.background).toBe('#FBF4EC');
    expect(palettes.dark.background).toBe('#121214');
  });

  test('createThemedStyles는 지금 모드의 스타일시트를 돌려준다', () => {
    const useStyles = createThemedStyles((colors) => ({ box: { backgroundColor: colors.background } }));
    const { result, rerender } = renderHook(() => useStyles());
    expect(StyleSheet.flatten(result.current.box).backgroundColor).toBe(palettes.light.background);

    scheme.mockReturnValue('dark');
    rerender({});
    expect(StyleSheet.flatten(result.current.box).backgroundColor).toBe(palettes.dark.background);
  });
});

describe('공통 부품', () => {
  test('AppText는 자간을 글자 크기의 -0.02em으로 채우고, 정한 자간은 그대로 둔다', () => {
    render(<><AppText>본문</AppText><AppText style={{ fontSize: 12 }}>캡션</AppText><AppText style={{ letterSpacing: -1.1 }}>로고</AppText></>);
    expect(StyleSheet.flatten(screen.getByText('본문').props.style).letterSpacing).toBeCloseTo(-0.32);
    expect(StyleSheet.flatten(screen.getByText('캡션').props.style).letterSpacing).toBeCloseTo(-0.24);
    expect(StyleSheet.flatten(screen.getByText('로고').props.style).letterSpacing).toBe(-1.1);
  });

  test.each(['light', 'dark'] as const)('주 버튼은 %s 모드에서도 노른자 노랑 알약이다', (mode) => {
    scheme.mockReturnValue(mode);
    render(<><Button label="1화 무료로 보기" onPress={jest.fn()} /><Button label="닫기" variant="secondary" onPress={jest.fn()} /></>);

    const primary = StyleSheet.flatten(screen.getByRole('button', { name: '1화 무료로 보기' }).props.style);
    expect(primary).toMatchObject({ backgroundColor: palettes[mode].yolk, borderRadius: 9999, minHeight: 48 });
    expect(StyleSheet.flatten(screen.getByText('1화 무료로 보기').props.style).color).toBe(palettes[mode].onYolk);
    expect(StyleSheet.flatten(screen.getByRole('button', { name: '닫기' }).props.style).backgroundColor).toBe(palettes[mode].elevated);
  });

  test('구역 제목은 머리글 역할의 제목 하나만 보여 준다', () => {
    render(<SectionTitle title="이어보기" action="전체보기" onAction={jest.fn()} />);
    expect(screen.getByRole('header', { name: '이어보기' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '전체보기' })).toBeOnTheScreen();
  });

  test('빈 화면은 제목과 설명을 보여 준다', () => {
    render(<EmptyState title="저장한 작품이 없어요" description="마음에 드는 작품을 저장해 보세요." />);
    expect(screen.getByText('저장한 작품이 없어요')).toBeOnTheScreen();
    expect(screen.getByText('마음에 드는 작품을 저장해 보세요.')).toBeOnTheScreen();
  });
});

describe('AppTopBar', () => {
  test('peeka 로고, 화면 모드 버튼, 포인트 알약만 두고 헤더 돋보기는 두지 않는다', () => {
    render(<AppTopBar />);
    expect(screen.getByRole('button', { name: '홈으로 이동' })).toBeOnTheScreen();
    expect(screen.getByText('peeka')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '사용 가능한 포인트는 1,200 P예요, 포인트 화면 열기' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '작품 찾기' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '다크 모드로 바꾸기' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  test('다크 모드에서는 먹색 표면 위에 포인트 알약을 그린다', () => {
    scheme.mockReturnValue('dark');
    render(<AppTopBar />);
    const pill = StyleSheet.flatten(screen.getByRole('button', { name: /포인트 화면 열기$/ }).props.style);
    expect(pill).toMatchObject({ backgroundColor: palettes.dark.surface, borderColor: palettes.dark.borderStrong });
  });
});

describe('화면 모드 선택', () => {
  const saved = jest.mocked(readThemePreference);
  const save = jest.mocked(writeThemePreference);
  const background = () => StyleSheet.flatten(screen.getByTestId('themed').props.style).backgroundColor;
  const useStyles = createThemedStyles((colors) => ({ box: { backgroundColor: colors.background } }));
  function Themed() {
    return <View testID="themed" style={useStyles().box} />;
  }
  const renderApp = () => render(<ThemeProvider><AppTopBar /><Themed /></ThemeProvider>);

  beforeEach(() => saved.mockReturnValue(null));

  test.each(['light', 'dark'] as const)('저장한 선택이 없으면 기기 모드(%s)를 따른다', (mode) => {
    scheme.mockReturnValue(mode);
    renderApp();
    expect(background()).toBe(palettes[mode].background);
    expect(screen.getByRole('button', { name: mode === 'dark' ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기' })).toBeOnTheScreen();
    expect(save).not.toHaveBeenCalled();
  });

  test('해/달 버튼은 지금 모드의 반대로 바꾸고 모든 화면 색과 버튼 이름을 함께 바꾼다', () => {
    renderApp();
    const toggle = screen.getByRole('button', { name: '다크 모드로 바꾸기' });
    expect(StyleSheet.flatten(toggle.props.style)).toMatchObject({ width: 44, height: 44 });

    fireEvent.press(toggle);
    expect(background()).toBe(palettes.dark.background);
    expect(StyleSheet.flatten(screen.getByRole('button', { name: /포인트 화면 열기$/ }).props.style).backgroundColor).toBe(palettes.dark.surface);
    expect(save).toHaveBeenLastCalledWith('dark');

    fireEvent.press(screen.getByRole('button', { name: '라이트 모드로 바꾸기' }));
    expect(background()).toBe(palettes.light.background);
    expect(screen.getByRole('button', { name: '다크 모드로 바꾸기' })).toBeOnTheScreen();
    expect(save).toHaveBeenLastCalledWith('light');
  });

  test('저장한 선택은 다음 실행에서 첫 렌더부터 기기 모드보다 앞선다', () => {
    renderApp();
    fireEvent.press(screen.getByRole('button', { name: '다크 모드로 바꾸기' }));
    screen.unmount();

    saved.mockReturnValue(save.mock.lastCall![0]);
    scheme.mockReturnValue('light');
    renderApp();
    expect(background()).toBe(palettes.dark.background);
    expect(screen.getByRole('button', { name: '라이트 모드로 바꾸기' })).toBeOnTheScreen();
  });

  test('저장소를 읽거나 쓰지 못해도 기기 모드로 시작하고 이번 실행의 선택은 적용한다', () => {
    saved.mockImplementation(() => { throw new Error('keychain'); });
    save.mockImplementation(() => { throw new Error('keychain'); });
    renderApp();
    expect(background()).toBe(palettes.light.background);

    fireEvent.press(screen.getByRole('button', { name: '다크 모드로 바꾸기' }));
    expect(background()).toBe(palettes.dark.background);
  });
});
