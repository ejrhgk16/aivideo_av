import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Drama } from '@/features/drama/catalog';

// The existing public preview can be opened by recipients without installing the app.
export async function shareDrama(drama: Drama): Promise<void> {
  const url = `https://ai-drama-screen.qwerqerqwere.chatgpt.site/?drama=${drama.id}`;
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(url);
    return;
  }
  await Share.share({ title: `${drama.title} | AI DRAMA`, message: `${drama.title}\n${url}` });
}
