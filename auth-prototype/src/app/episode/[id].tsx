import { useLocalSearchParams } from 'expo-router';
import { PlaybackScreenEpisode } from '@/screens/playbackScreen_episode';

export default function EpisodeRoute() {
  const { id, dramaId } = useLocalSearchParams<{
    id: string;
    dramaId?: string;
  }>();
  return <PlaybackScreenEpisode id={id} dramaId={dramaId} />;
}
