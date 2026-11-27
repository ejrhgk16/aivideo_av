import { render, renderHook, screen } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';
import { palettes } from '@/common/theme/tokens';
import { createThemedStyles, useColors, useColorSchemeName } from '@/common/theme/theme';
import { AppText, Button, EmptyState, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { useUser } from '@/features/user/UserProvider';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));
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
  test('peeka 로고와 포인트 알약만 두고 헤더 돋보기는 두지 않는다', () => {
    render(<AppTopBar />);
    expect(screen.getByRole('button', { name: '홈으로 이동' })).toBeOnTheScreen();
    expect(screen.getByText('peeka')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '사용 가능한 포인트는 1,200 P예요, 포인트 화면 열기' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '작품 찾기' })).not.toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  test('다크 모드에서는 먹색 표면 위에 포인트 알약을 그린다', () => {
    scheme.mockReturnValue('dark');
    render(<AppTopBar />);
    const pill = StyleSheet.flatten(screen.getByRole('button', { name: /포인트 화면 열기$/ }).props.style);
    expect(pill).toMatchObject({ backgroundColor: palettes.dark.surface, borderColor: palettes.dark.borderStrong });
  });
});
