import React from 'react';
import { BackHandler, Text, TextInput } from 'react-native';
import { act, screen, userEvent } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import AuthLoginRoute from '@/app/auth/login';
import AuthOnboardingRoute from '@/app/auth/onboarding';
import * as refreshTokenStorage from '@/common/storage/refreshTokenStorage';

jest.mock('@expo/vector-icons/FontAwesome', () => {
  const { Text: MockText } = require('react-native');
  return function MockFontAwesome() {
    return <MockText />;
  };
});

jest.mock('@/features/user/UserProvider', () => {
  const context = {
    accessToken: null,
    user: null,
    points: null,
    isRestoring: false,
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
    isCurrentSession: jest.fn(() => true),
    setSubtitlesEnabled: jest.fn(),
    setPreferredSubtitleLanguage: jest.fn(),
    setAutoplayNext: jest.fn(),
  };
  return { useUser: jest.fn(() => context), __authTestContext: context };
});

jest.mock('@/common/storage/refreshTokenStorage', () => ({
  readRefreshToken: jest.fn(async () => null),
  writeRefreshToken: jest.fn(async () => undefined),
  removeRefreshToken: jest.fn(async () => undefined),
}));

const FIXED_NOW = new Date('2026-11-13T03:00:00.000Z');
const authTestContext = jest.requireMock('@/features/user/UserProvider').__authTestContext as {
  login: jest.Mock;
  setUser: jest.Mock;
};
let originalFetch: typeof fetch;
let mockFetch: jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  mockFetch.mockResolvedValue({ ok: true } as Response);
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createUser() {
  jest.useFakeTimers({ now: FIXED_NOW });
  return userEvent.setup();
}

function renderAuth(initialUrl: string, originTarget: '/auth/login' | '/auth/onboarding' = '/auth/login') {
  return renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: () => <Text>홈 화면</Text>,
    away: () => (
      <Text
        accessibilityRole="button"
        onPress={() => router.push(originTarget)}
      >
        이전 화면에서 인증 열기
      </Text>
    ),
    'auth/login': AuthLoginRoute,
    'auth/onboarding': AuthOnboardingRoute,
  }, { initialUrl });
}

async function openFrom(target: '/auth/login' | '/auth/onboarding') {
  const view = renderAuth('/away', target);
  const user = createUser();
  await user.press(screen.getByRole('button', { name: '이전 화면에서 인증 열기' }));
  expect(await screen.findByRole('header')).toBeOnTheScreen();
  return { view, user };
}

async function agreeAll(user: ReturnType<typeof userEvent.setup>) {
  await user.press(screen.getByRole('checkbox', { name: '전체 동의' }));
  await user.press(screen.getByRole('button', { name: '다음' }));
}

async function enterBirth(
  user: ReturnType<typeof userEvent.setup>,
  year: string,
  month: string,
  day: string,
) {
  for (const [label, value] of [['출생 연도', year], ['출생 월', month], ['출생 일', day]]) {
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), value);
  }
}

function expectNoAuthOrStorageSideEffects() {
  expect(authTestContext.login).not.toHaveBeenCalled();
  expect(authTestContext.setUser).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(refreshTokenStorage.readRefreshToken).not.toHaveBeenCalled();
  expect(refreshTokenStorage.writeRefreshToken).not.toHaveBeenCalled();
  expect(refreshTokenStorage.removeRefreshToken).not.toHaveBeenCalled();
}

describe('소셜 로그인 화면 시안', () => {
  test('별도 회원가입 없이 Google·카카오·네이버 로그인을 표시한다', () => {
    renderAuth('/auth/login');
    expect(screen.getByText('로그인하고 시작하기')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /로 로그인$/ }).map(button => button.props.accessibilityLabel))
      .toEqual(['Google로 로그인', '카카오로 로그인', '네이버로 로그인']);
    expect(screen.queryByRole('button', { name: 'Apple로 로그인' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '회원가입' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: '처음이라면 시작하기' })).not.toBeOnTheScreen();
    expect(screen.getByText('시안 화면이에요. 실제 로그인은 연결 전이에요.')).toBeOnTheScreen();
    expectNoAuthOrStorageSideEffects();
  });

  test.each(['Google', '카카오', '네이버'] as const)('%s 선택 후 첫 이용 약관으로 이동한다', async provider => {
    const user = createUser();
    const view = renderAuth('/auth/login');
    await user.press(screen.getByRole('button', { name: `${provider}로 로그인` }));
    expect(await screen.findByRole('header', { name: '약관에 동의해 주세요' })).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/auth/onboarding');
    expect(screen.queryByRole('link', { name: '이미 계정이 있나요? 로그인' })).not.toBeOnTheScreen();
    expectNoAuthOrStorageSideEffects();
    await user.press(screen.getByRole('button', { name: '이전' }));
    expect(await screen.findByRole('button', { name: 'Google로 로그인' })).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/auth/login');
  });

  test('닫기는 이전 화면으로 돌아가고 직접 진입한 나중에 하기는 홈으로 간다', async () => {
    const { view, user } = await openFrom('/auth/login');
    await user.press(screen.getByRole('button', { name: '닫기' }));
    expect(await screen.findByText('이전 화면에서 인증 열기')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/away');
    view.unmount();

    const directUser = createUser();
    const direct = renderAuth('/auth/login');
    await directUser.press(screen.getByRole('button', { name: '나중에 할게요' }));
    expect(await screen.findByText('홈 화면')).toBeOnTheScreen();
    expect(direct.getPathname()).toBe('/');
  });

  test('직접 진입한 첫 이용 설정에서 이전은 로그인 화면으로 간다', async () => {
    const user = createUser();
    const view = renderAuth('/auth/onboarding');
    await user.press(screen.getByRole('button', { name: '이전' }));
    expect(await screen.findByRole('button', { name: 'Google로 로그인' })).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/auth/login');
  });
});

describe('첫 이용 설정 시안', () => {
  test('필수 약관 두 개가 모두 선택되어야 다음 단계로 갈 수 있다', async () => {
    const user = createUser();
    renderAuth('/auth/onboarding');
    expect(screen.getByText('1/3')).toBeOnTheScreen();
    const next = screen.getByRole('button', { name: '다음' });
    const all = screen.getByRole('checkbox', { name: '전체 동의' });
    const terms = screen.getByRole('checkbox', { name: '이용약관 (필수)' });
    const privacy = screen.getByRole('checkbox', { name: '개인정보 수집·이용 (필수)' });
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(next).toBeDisabled();

    await user.press(terms);
    expect(terms).toBeChecked();
    expect(all).not.toBeChecked();
    expect(next).toBeDisabled();
    await user.press(privacy);
    expect(all).toBeChecked();
    expect(next).toBeEnabled();

    await user.press(all);
    expect(terms).not.toBeChecked();
    expect(privacy).not.toBeChecked();
    expect(next).toBeDisabled();
    await user.press(all);
    expect(terms).toBeChecked();
    expect(privacy).toBeChecked();
    expect(next).toBeEnabled();
  });

  test('보기는 임시 약관을 열고 동의 상태를 바꾸지 않는다', async () => {
    const user = createUser();
    renderAuth('/auth/onboarding');
    await user.press(screen.getByRole('button', { name: '이용약관 보기' }));
    expect(screen.getByText('확정 전 약관이에요. 출시 전 법률 검토 후 바뀌어요.')).toBeOnTheScreen();
    expect(screen.getByText('이 서비스는 AI로 생성한 영상과 음성이 포함된 드라마를 제공해요.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByText('확정 전 약관이에요. 출시 전 법률 검토 후 바뀌어요.')).not.toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: '이용약관 (필수)' })).not.toBeChecked();
  });

  test('숫자와 입력 길이를 제한하고 생년월 입력이 끝나면 다음 칸에 포커스한다', async () => {
    const user = createUser();
    const textInputComponent = TextInput as unknown as { prototype: { focus: () => void } };
    const focusSpy = jest.spyOn(textInputComponent.prototype, 'focus');
    renderAuth('/auth/onboarding');
    await agreeAll(user);
    await user.type(screen.getByLabelText('출생 연도'), '2012x');
    expect(screen.getByLabelText('출생 연도')).toHaveDisplayValue('2012');
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy.mock.contexts[0]).toMatchObject({ props: { accessibilityLabel: '출생 월' } });

    await user.type(screen.getByLabelText('출생 월'), '11x');
    expect(screen.getByLabelText('출생 월')).toHaveDisplayValue('11');
    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(focusSpy.mock.contexts[1]).toMatchObject({ props: { accessibilityLabel: '출생 일' } });
    await user.type(screen.getByLabelText('출생 일'), '13x');
    expect(screen.getByLabelText('출생 일')).toHaveDisplayValue('13');
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  test('잘못된 날짜와 미래 날짜를 안내하고 이전 단계에서 동의·입력을 보존한다', async () => {
    const user = createUser();
    renderAuth('/auth/onboarding');
    await agreeAll(user);
    expect(screen.getByRole('header', { name: '생년월일을 입력해 주세요' })).toBeOnTheScreen();
    expect(screen.getByText('2/3')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    await enterBirth(user, '2011', '02', '29');
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('달력에 없는 날짜예요. 다시 확인해 주세요.')).toBeOnTheScreen();

    await enterBirth(user, '2027', '01', '01');
    expect(screen.getByText('오늘 이후 날짜는 입력할 수 없어요.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('header', { name: '생년월일을 입력해 주세요' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByRole('checkbox', { name: '이용약관 (필수)' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '개인정보 수집·이용 (필수)' })).toBeChecked();
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByLabelText('출생 연도')).toHaveDisplayValue('2027');
    expect(screen.getByLabelText('출생 월')).toHaveDisplayValue('01');
    expect(screen.getByLabelText('출생 일')).toHaveDisplayValue('01');
  });

  test('만 14세 생일 당일은 시작 단계로 넘어가고 홈으로 완료한다', async () => {
    const user = createUser();
    const view = renderAuth('/auth/login');
    await user.press(screen.getByRole('button', { name: 'Google로 로그인' }));
    expect(await screen.findByRole('header', { name: '약관에 동의해 주세요' })).toBeOnTheScreen();
    await agreeAll(user);
    await enterBirth(user, '2012', '11', '13');
    expect(screen.getByText('2012년 11월 13일로 입력했어요. 다음을 누르면 바꾸기 어려워요.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('header', { name: '시작할 준비가 됐어요' })).toBeOnTheScreen();
    expect(screen.getByText('3/3')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '이전' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: '이미 계정이 있나요? 로그인' })).not.toBeOnTheScreen();
    expectNoAuthOrStorageSideEffects();

    await user.press(screen.getByRole('button', { name: '시작하기' }));
    expect(await screen.findByText('홈 화면')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/');
    expectNoAuthOrStorageSideEffects();
  });

  test('만 14세 생일 전날은 보호자 안내를 보이고 대기·무료 시작은 로컬 동작이다', async () => {
    const user = createUser();
    const view = renderAuth('/auth/onboarding');
    await agreeAll(user);
    await enterBirth(user, '2012', '11', '14');
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('header', { name: '보호자 동의가 필요해요' })).toBeOnTheScreen();
    for (const item of ['무료 회차 보기', '찜하기', '시청 기록 저장', '포인트 충전', '포인트로 회차 열기', '광고 보고 포인트 받기']) {
      expect(screen.getByText(item)).toBeOnTheScreen();
    }
    expect(screen.getByText('보호자 동의 전에는 맞춤형 광고를 보여주지 않아요.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '무료 시청으로 시작하기' })).toBeOnTheScreen();
    expectNoAuthOrStorageSideEffects();

    await user.press(screen.getByRole('button', { name: '보호자 동의 요청하기' }));
    expect(screen.getByText('보호자 동의를 기다리고 있어요')).toBeOnTheScreen();
    expect(screen.getByText(/보호자 확인 방법은 법률 검토 후 정해요/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '보호자 동의 요청하기' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '이전' })).not.toBeOnTheScreen();
    expectNoAuthOrStorageSideEffects();

    await user.press(screen.getByRole('button', { name: '무료 시청으로 시작하기' }));
    expect(await screen.findByText('홈 화면')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/');
    expectNoAuthOrStorageSideEffects();
  });

  test('2단계에서 Android back으로 돌아가도 동의와 출생 정보를 보존한다', async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    const backSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
      handlers.push(() => handler({} as never));
      return { remove: jest.fn() };
    });
    const user = createUser();
    const view = renderAuth('/auth/onboarding');
    const beforeStep2 = handlers.length;
    await agreeAll(user);
    await enterBirth(user, '2012', '11', '14');
    expect(screen.getByLabelText('출생 연도')).toHaveDisplayValue('2012');
    expect(screen.getByLabelText('출생 월')).toHaveDisplayValue('11');
    expect(screen.getByLabelText('출생 일')).toHaveDisplayValue('14');
    expect(handlers.length).toBeGreaterThan(beforeStep2);

    const appBackHandler = handlers[handlers.length - 1];
    expect(appBackHandler).toBeDefined();
    let handled: boolean | null | undefined;
    act(() => { handled = appBackHandler?.(); });
    expect(handled).toBe(true);
    expect(screen.getByRole('header', { name: '약관에 동의해 주세요' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: '이용약관 (필수)' })).toBeChecked();
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByLabelText('출생 연도')).toHaveDisplayValue('2012');
    expect(screen.getByLabelText('출생 월')).toHaveDisplayValue('11');
    expect(screen.getByLabelText('출생 일')).toHaveDisplayValue('14');

    backSpy.mockRestore();
    expect(view.getPathname()).toBe('/auth/onboarding');
  });
});
