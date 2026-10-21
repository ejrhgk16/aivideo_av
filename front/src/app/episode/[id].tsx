import { useLocalSearchParams } from 'expo-router';
import { EpisodePlaybackScreen } from '@/screens/EpisodePlaybackScreen';

export default function EpisodeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EpisodePlaybackScreen id={id} />;
}
