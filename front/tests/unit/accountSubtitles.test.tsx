import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { Stack, useRouter } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { AccountScreen } from '@/screens/AccountScreen';
import { UserProvider, useUser } from '@/features/user/UserProvider';

function TestLayout() {
  return <UserProvider><Stack screenOptions={{ animation: 'none' }} /></UserProvider>;
}

function AccountRoute() {
  const router = useRouter();
  const { subtitlesEnabled, preferredSubtitleLanguage } = useUser();
  return <>
    <AccountScreen />
    <Text>{`subtitle-state:${subtitlesEnabled}:${preferredSubtitleLanguage}`}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="다른 화면 열기" onPress={() => router.push('/points')} />
  </>;
}

function PreferenceRoute() {
  const router = useRouter();
  const { setPreferredSubtitleLanguage } = useUser();
  return <>
    <Text>다른 화면</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="영어 선호 저장" onPress={() => setPreferredSubtitleLanguage('en')} />
    <Pressable accessibilityRole="button" accessibilityLabel="계정으로 돌아가기" onPress={() => router.back()} />
  </>;
}

test('account switch shares subtitle state and language preference survives route changes', async () => {
  renderRouter({
    _layout: TestLayout,
    account: AccountRoute,
    points: PreferenceRoute,
  }, { initialUrl: '/account' });

  expect(screen.getByText('subtitle-state:true:ko')).toBeOnTheScreen();
  await userEvent.setup().press(await screen.findByRole('button', { name: '재생 설정' }));
  const subtitleSwitch = screen.getByRole('switch', { name: '자막 표시' });
  expect(subtitleSwitch).toBeEnabled();
  expect(subtitleSwitch).toBeChecked();
  fireEvent(subtitleSwitch, 'valueChange', false);
  expect(screen.getByText('subtitle-state:false:ko')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '닫기' }));

  await userEvent.setup().press(screen.getByRole('button', { name: '다른 화면 열기' }));
  await screen.findByText('다른 화면');
  await userEvent.setup().press(screen.getByRole('button', { name: '영어 선호 저장' }));
  await userEvent.setup().press(screen.getByRole('button', { name: '계정으로 돌아가기' }));
  await screen.findByText('subtitle-state:false:en');
  await userEvent.setup().press(screen.getByRole('button', { name: '재생 설정' }));
  expect(screen.getByRole('switch', { name: '자막 표시' })).not.toBeChecked();
});
