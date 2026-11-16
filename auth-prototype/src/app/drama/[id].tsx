import { useLocalSearchParams } from 'expo-router';
import { DramaDetailScreen } from '@/screens/DramaDetailScreen';

export default function DramaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DramaDetailScreen id={id} />;
}
