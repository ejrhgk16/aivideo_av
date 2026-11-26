import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import WebTabLayout from '@/app/(tabs)/_layout.web';

test('the bottom tab for the preview feed is named 빼꼼', async () => {
  renderRouter({
    '(tabs)/_layout': WebTabLayout,
    '(tabs)/index': () => <Text>홈 화면</Text>,
    '(tabs)/recommend': () => <Text>빼꼼 화면</Text>,
    '(tabs)/search': () => <Text>찾기 화면</Text>,
    '(tabs)/library': () => <Text>보관함 화면</Text>,
    '(tabs)/account': () => <Text>내 정보 화면</Text>,
  }, { initialUrl: '/' });
  expect(await screen.findByLabelText('빼꼼 탭')).toBeOnTheScreen();
  expect(screen.getByText('빼꼼')).toBeOnTheScreen();
  expect(screen.queryByText('추천')).toBeNull();
});
