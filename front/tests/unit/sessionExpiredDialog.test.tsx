import { Modal, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { SessionExpiredDialog } from '@/components/SessionExpiredDialog';
import RootLayout from '@/app/_layout';
import { useUser } from '@/features/user/UserProvider';

jest.mock('@/features/user/UserProvider', () => ({
  UserProvider: ({ children }: { children: React.ReactNode }) => children,
  useUser: jest.fn(),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const mockedUseUser = jest.mocked(useUser);

test('expiration dialog closes only through the chosen action', () => {
  const onDismiss = jest.fn();
  const onLogin = jest.fn();
  const view = render(<SessionExpiredDialog visible onDismiss={onDismiss} onLogin={onLogin} />);

  expect(screen.getByText('로그인이 만료됐어요')).toBeOnTheScreen();
  expect(screen.getByText('다시 로그인해 주세요.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '닫기' }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onLogin).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: '로그인' }));
  expect(onLogin).toHaveBeenCalledTimes(1);

  view.rerender(<SessionExpiredDialog visible={false} onDismiss={onDismiss} onLogin={onLogin} />);
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
});

test('root layout displays one expiration notice, dismisses from system close and routes only after login', () => {
  const dismissSessionExpired = jest.fn();
  mockedUseUser.mockReturnValue({
    user: null,
    points: null,
    accessToken: null,
    isRestoring: false,
    restoreError: null,
    sessionExpired: true,
    sessionVersion: 1,
    subtitlesEnabled: true,
    autoplayNext: false,
    setUser: jest.fn(),
    setPoints: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    dismissSessionExpired,
    isCurrentSession: (version) => version === 1,
    setSubtitlesEnabled: jest.fn(),
    setAutoplayNext: jest.fn(),
  });

  const router = renderRouter({
    _layout: RootLayout,
    '(tabs)/_layout': () => <Slot />,
    '(tabs)/index': () => <Text>탭 fixture</Text>,
    'drama/[id]': () => <Text>작품 fixture</Text>,
    'episode/[id]': () => <Text>회차 fixture</Text>,
    'preview/[dramaId]/[videoId]': () => <Text>미리보기 fixture</Text>,
    points: () => <Text>포인트 fixture</Text>,
    login: () => <Text>로그인 경로</Text>,
  });

  expect(screen.getAllByText('로그인이 만료됐어요')).toHaveLength(1);
  expect(screen.getByText('다시 로그인해 주세요.')).toBeOnTheScreen();
  const modal = screen.UNSAFE_getByType(Modal);
  act(() => fireEvent(modal, 'requestClose'));
  expect(dismissSessionExpired).toHaveBeenCalledTimes(1);
  expect(router.getPathname()).toBe('/');

  fireEvent.press(screen.getByRole('button', { name: '닫기' }));
  expect(dismissSessionExpired).toHaveBeenCalledTimes(2);
  expect(router.getPathname()).toBe('/');

  fireEvent.press(screen.getByRole('button', { name: '로그인' }));
  expect(dismissSessionExpired).toHaveBeenCalledTimes(3);
  expect(router.getPathname()).toBe('/login');
  expect(screen.getByText('로그인 경로')).toBeOnTheScreen();
});

test('hidden expiration notice does not expose its message to users', () => {
  render(<SessionExpiredDialog visible={false} onDismiss={jest.fn()} onLogin={jest.fn()} />);
  expect(screen.queryByText('로그인이 만료됐어요')).not.toBeOnTheScreen();
  expect(screen.queryByText('다시 로그인해 주세요.')).not.toBeOnTheScreen();
});
