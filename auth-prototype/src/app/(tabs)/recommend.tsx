import { useLocalSearchParams } from 'expo-router';
import { RecommendationScreen } from '@/screens/RecommendationScreen';

export default function RecommendationRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <RecommendationScreen initialId={id} />;
}
