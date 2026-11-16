import React from 'react';
import { BackHandler, Text } from 'react-native';
import { act, screen, userEvent } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import AuthLoginRoute from '@/app/auth/login';
import AuthSignupRoute from '@/app/auth/signup';
import { kstToday } from '@/features/auth/authAge';

jest.mock('@expo/vector-icons/FontAwesome', () => {
  const { Text: MockText } = require('react-native');
  return function MockFontAwesome() {
    return <MockText />;
  };
});

function renderAuth(initialUrl: string) {
  return renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: () => <Text>홈 화면</Text>,
    away: () => <Text>이전 화면</Text>,
    'auth/login': AuthLoginRoute,
    'auth/signup': AuthSignupRoute,
  }, { initialUrl });
}

async function openFrom(origin: string, target: '/auth/login' | '/auth/signup') {
  const view = renderAuth(origin);
  act(() => router.push(target));
  expect(await screen.findByRole('header')).toBeOnTheScreen();
  return view;
}

const thisYear = kstToday(new Date()).year;

describe('login', () => {
  test('lists Apple, Google and Kakao in order with the prototype notice and no implicit consent copy', () => {
    renderAuth('/auth/login');
    expect(screen.getByRole('header', { name: 'AI DRAMA 로그인' })).toBeOnTheScreen();
    expect(screen.getByText('보던 드라마, 어디서든 이어서')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /로 로그인$/ }).map((button) => button.props.accessibilityLabel))
      .toEqual(['Apple로 로그인', 'Google로 로그인', '카카오로 로그인']);
    expect(screen.getByText('카카오 로그인은 도입을 검토 중이에요.')).toBeOnTheScreen();
    expect(screen.getByText('시안 화면이에요. 실제 로그인은 연결 전이에요.')).toBeOnTheScreen();
    expect(screen.queryByText(/동의한 것으로/)).not.toBeOnTheScreen();
  });

  test('a provider press shows a simulated result and 확인 returns to the previous screen', async () => {
    const user = userEvent.setup();
    const view = await openFrom('/away', '/auth/login');
    await user.press(screen.getByRole('button', { name: 'Google로 로그인' }));
    expect(screen.getByText('Google 계정으로 연결했어요 (시안)')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Apple로 로그인' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('header')).not.toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: '처음이라면 시작하기' })).not.toBeOnTheScreen();
    expect(screen.getByText('시안 화면이에요. 실제 로그인은 연결 전이에요.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '확인' }));
    expect(await screen.findByText('이전 화면')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/away');
  });

  test('나중에 할게요 goes back when possible, otherwise home', async () => {
    const user = userEvent.setup();
    const withHistory = await openFrom('/away', '/auth/login');
    await user.press(screen.getByRole('button', { name: '나중에 할게요' }));
    expect(withHistory.getPathname()).toBe('/away');
    withHistory.unmount();

    const direct = renderAuth('/auth/login');
    await user.press(screen.getByRole('button', { name: '나중에 할게요' }));
    expect(await screen.findByText('홈 화면')).toBeOnTheScreen();
    expect(direct.getPathname()).toBe('/');
  });

  test('처음이라면 시작하기 opens the first-run flow', async () => {
    const user = userEvent.setup();
    const view = renderAuth('/auth/login');
    await user.press(screen.getByRole('link', { name: '처음이라면 시작하기' }));
    expect(await screen.findByRole('header', { name: '약관에 동의해 주세요' })).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/auth/signup');
  });
});

describe('signup', () => {
  async function agreeAll(user: ReturnType<typeof userEvent.setup>) {
    await user.press(screen.getByRole('checkbox', { name: '전체 동의' }));
    await user.press(screen.getByRole('button', { name: '다음' }));
  }

  async function enterBirth(user: ReturnType<typeof userEvent.setup>, year: string, month: string, day: string) {
    for (const [label, value] of [['출생 연도', year], ['출생 월', month], ['출생 일', day]]) {
      await user.clear(screen.getByLabelText(label));
      await user.type(screen.getByLabelText(label), value);
    }
  }

  test('다음 needs both required consents, and 전체 동의 toggles both', async () => {
    const user = userEvent.setup();
    renderAuth('/auth/signup');
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

  test('보기 opens the placeholder document without changing consent', async () => {
    const user = userEvent.setup();
    renderAuth('/auth/signup');
    await user.press(screen.getByRole('button', { name: '이용약관 보기' }));
    expect(screen.getByText('확정 전 약관이에요. 출시 전 법률 검토 후 바뀌어요.')).toBeOnTheScreen();
    expect(screen.getByText('이 서비스는 AI로 생성한 영상과 음성이 포함된 드라마를 제공해요.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByText('확정 전 약관이에요. 출시 전 법률 검토 후 바뀌어요.')).not.toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: '이용약관 (필수)' })).not.toBeChecked();
  });

  test('invalid and future birth dates show an error; 이전 keeps consents and entered values', async () => {
    const user = userEvent.setup();
    renderAuth('/auth/signup');
    await agreeAll(user);
    expect(screen.getByRole('header', { name: '생년월일을 입력해 주세요' })).toBeOnTheScreen();
    expect(screen.getByText('2/3')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    await enterBirth(user, '2010', '02', '30');
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('달력에 없는 날짜예요. 다시 확인해 주세요.')).toBeOnTheScreen();

    await enterBirth(user, String(thisYear + 1), '01', '01');
    expect(screen.getByText('오늘 이후 날짜는 입력할 수 없어요.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('header', { name: '생년월일을 입력해 주세요' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByRole('checkbox', { name: '이용약관 (필수)' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '개인정보 수집·이용 (필수)' })).toBeChecked();
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByLabelText('출생 연도')).toHaveDisplayValue(String(thisYear + 1));
    expect(screen.getByLabelText('출생 월')).toHaveDisplayValue('01');
    expect(screen.getByLabelText('출생 일')).toHaveDisplayValue('01');
  });

  test('14 and older completes to home', async () => {
    const user = userEvent.setup();
    const view = await openFrom('/away', '/auth/signup');
    await agreeAll(user);
    await enterBirth(user, '1990', '1', '1');
    expect(screen.getByText('1990년 1월 1일로 입력했어요. 다음을 누르면 바꾸기 어려워요.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('header', { name: '시작할 준비가 됐어요' })).toBeOnTheScreen();
    expect(screen.getByText('3/3')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '이전' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: '이미 계정이 있나요? 로그인' })).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '시작하기' }));
    expect(await screen.findByText('홈 화면')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/');
  });

  test('under 14 shows the guardian notice; requesting consent shows a waiting state and free viewing goes home', async () => {
    const user = userEvent.setup();
    const view = renderAuth('/auth/signup');
    await agreeAll(user);
    await enterBirth(user, String(thisYear - 5), '01', '01');
    await user.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('header', { name: '보호자 동의가 필요해요' })).toBeOnTheScreen();
    for (const item of ['무료 회차 보기', '찜하기', '시청 기록 저장', '포인트 충전', '포인트로 회차 열기', '광고 보고 포인트 받기']) {
      expect(screen.getByText(item)).toBeOnTheScreen();
    }
    expect(screen.getByText('보호자 동의 전에는 맞춤형 광고를 보여주지 않아요.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '무료 시청으로 시작하기' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: '보호자 동의 요청하기' }));
    expect(screen.getByText('보호자 동의를 기다리고 있어요')).toBeOnTheScreen();
    expect(screen.getByText(/보호자 확인 방법은 법률 검토 후 정해요/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '보호자 동의 요청하기' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '이전' })).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: '무료 시청으로 시작하기' }));
    expect(await screen.findByText('홈 화면')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/');
  });

  test('이미 계정이 있나요? 로그인 opens the login screen', async () => {
    const user = userEvent.setup();
    const view = renderAuth('/auth/signup');
    await user.press(screen.getByRole('link', { name: '이미 계정이 있나요? 로그인' }));
    expect(await screen.findByRole('button', { name: 'Apple로 로그인' })).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/auth/login');
  });

  test('login opened from signup returns to the same step on 나중에 할게요 or 처음이라면 시작하기', async () => {
    const user = userEvent.setup();
    const view = renderAuth('/auth/signup');
    await user.press(screen.getByRole('checkbox', { name: '이용약관 (필수)' }));
    for (const action of [{ role: 'button', name: '나중에 할게요' }, { role: 'link', name: '처음이라면 시작하기' }] as const) {
      await user.press(screen.getByRole('link', { name: '이미 계정이 있나요? 로그인' }));
      await user.press(await screen.findByRole(action.role, { name: action.name }));
      expect(await screen.findByRole('header', { name: '약관에 동의해 주세요' })).toBeOnTheScreen();
      expect(screen.getByRole('checkbox', { name: '이용약관 (필수)' })).toBeChecked();
      expect(view.getPathname()).toBe('/auth/signup');
    }
    await user.press(screen.getByRole('link', { name: '이미 계정이 있나요? 로그인' }));
    await user.press(await screen.findByRole('button', { name: '닫기' }));
    expect(await screen.findByRole('header', { name: '약관에 동의해 주세요' })).toBeOnTheScreen();
  });

  test('Android back on the birth date step returns to the consent step', async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
      handlers.push(() => handler({} as never));
      return { remove: jest.fn() };
    });
    const user = userEvent.setup();
    renderAuth('/auth/signup');
    const beforeStep2 = handlers.length; // the navigator registers its own listener on mount
    await agreeAll(user);
    expect(handlers).toHaveLength(beforeStep2 + 1);
    let handled: boolean | null | undefined;
    act(() => { handled = handlers[beforeStep2](); });
    expect(handled).toBe(true);
    expect(screen.getByRole('header', { name: '약관에 동의해 주세요' })).toBeOnTheScreen();
    spy.mockRestore();
  });
});
