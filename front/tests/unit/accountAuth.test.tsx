import React from 'react';
import { Text } from 'react-native';
import { act, screen, userEvent } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { AccountScreen } from '@/screens/AccountScreen';
import { useUser } from '@/features/user/UserProvider';

jest.mock('@/features/user/UserProvider', () => ({
  useUser: jest.fn(),
}));

const mockedUseUser = jest.mocked(useUser);

function renderAccount(accountType: 'GUEST' | 'MEMBER' | 'OPERATOR' | 'PARTNER' | null, isRestoring = false) {
  mockedUseUser.mockReturnValue({
    user: accountType === null ? null : { uuid: 'test-user', displayName: '테스트 사용자', accountType },
    points: null,
    accessToken: null,
    isRestoring,
    restoreError: null,
    sessionExpired: false,
    sessionVersion: 0,
    subtitlesEnabled: true,
    preferredSubtitleLanguage: 'ko',
    autoplayNext: false,
    setUser: jest.fn(),
    setPoints: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    dismissSessionExpired: jest.fn(),
    isCurrentSession: () => true,
    setSubtitlesEnabled: jest.fn(),
    setPreferredSubtitleLanguage: jest.fn(),
    setAutoplayNext: jest.fn(),
  });

  const session = mockedUseUser();
  let setSession!: React.Dispatch<React.SetStateAction<ReturnType<typeof useUser>>>;
  function AccountRoute() {
    const [current, update] = React.useState(session);
    setSession = update;
    mockedUseUser.mockReturnValue(current);
    return <AccountScreen />;
  }
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    account: AccountRoute,
    'auth/login': () => <Text>로그인 목적 화면</Text>,
  }, { initialUrl: '/account' });
  return { ...view, session, setSession: (next: ReturnType<typeof useUser>) => act(() => setSession(next)) };
}

describe('AccountScreen authentication entry', () => {
  test.each(['MEMBER', null] as const)('세션 복원 중 비회원 내용을 노출하지 않고 %s 결과로 전환한다', accountType => {
    const view = renderAccount(null, true);
    expect(screen.getByText('나의 작은 영화관')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '홈으로 이동' })).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: '로딩 중' })).toBeBusy();
    expect(screen.queryByText('게스트로 둘러보고 있어요')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '로그인하고 시작하기' })).not.toBeOnTheScreen();

    view.setSession({ ...view.session, isRestoring: false,
      user: accountType === null ? null : { uuid: 'test-user', displayName: '테스트 사용자', accountType },
      points: accountType === null ? null : 200,
    });

    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: accountType === null ? '로그인하고 시작하기' : '로그아웃' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: accountType === null ? '로그아웃' : '로그인하고 시작하기' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '홈으로 이동' })).toBeOnTheScreen();
  });

  test.each([
    ['미로그인', null],
    ['GUEST', 'GUEST'],
  ] as const)('%s에서 로그인 버튼이 인증 화면으로 이동한다', async (_state, accountType) => {
    const router = renderAccount(accountType);
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '회원가입' })).not.toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: '로그인하고 시작하기' }));

    expect(await screen.findByText('로그인 목적 화면')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth/login');
  });

  test.each(['MEMBER', 'OPERATOR', 'PARTNER'] as const)(
    '%s 계정에는 로그인과 회원가입 버튼을 표시하지 않는다', accountType => {
      renderAccount(accountType);

      expect(screen.queryByRole('button', { name: '로그인하고 시작하기' })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: '회원가입' })).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '로그아웃' })).toBeOnTheScreen();
    },
  );

  test('로그아웃 함수를 호출하고 내정보 화면을 유지한다', async () => {
    const view = renderAccount('MEMBER');
    jest.mocked(view.session.logout).mockResolvedValueOnce(undefined);

    await userEvent.setup().press(screen.getByRole('button', { name: '로그아웃' }));

    expect(view.session.logout).toHaveBeenCalledTimes(1);
    expect(view.getPathname()).toBe('/account');
  });

  test('로그아웃 요청 실패를 안내하고 버튼을 다시 활성화한다', async () => {
    const { session } = renderAccount('MEMBER');
    jest.mocked(session.logout).mockRejectedValueOnce(new Error('Network error'));

    await userEvent.setup().press(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃 요청을 완료하지 못했어요. 연결 상태를 확인해 주세요.');
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeEnabled();
  });
});
