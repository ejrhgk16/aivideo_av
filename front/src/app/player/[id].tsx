import { useLocalSearchParams } from 'expo-router';
import { PlayerScreen } from '@/screens/PlayerScreen';

export default function PlayerRoute() {
  const { id, ep } = useLocalSearchParams<{ id: string; ep?: string }>();
  return <PlayerScreen key={`${id}:${ep ?? 'resume'}`} id={id} episode={ep} />;
}
