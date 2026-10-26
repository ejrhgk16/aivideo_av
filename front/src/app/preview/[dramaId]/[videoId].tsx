import { useLocalSearchParams } from 'expo-router';
import { PlaybackScreenPreview } from '@/screens/playbackScreen_preview';

export default function PreviewRoute() {
  const { dramaId, videoId } = useLocalSearchParams<{ dramaId: string; videoId: string }>();
  return <PlaybackScreenPreview dramaId={dramaId} videoId={videoId} />;
}
