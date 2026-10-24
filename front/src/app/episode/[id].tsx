import { useLocalSearchParams } from 'expo-router';
import { ImmersiveEpisodePlaybackScreen } from '@/screens/ImmersiveEpisodePlaybackScreen';

export default function EpisodeRoute() {
  const { id, dramaId, dramaTitle } = useLocalSearchParams<{
    id: string;
    dramaId?: string;
    dramaTitle?: string;
  }>();
  return <ImmersiveEpisodePlaybackScreen id={id} dramaId={dramaId} dramaTitle={dramaTitle} />;
}
