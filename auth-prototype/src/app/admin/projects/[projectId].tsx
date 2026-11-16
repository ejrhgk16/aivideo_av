import { useLocalSearchParams } from 'expo-router';
import { AdminProjectScreen } from '@/screens/AdminProjectScreen';

export default function AdminProjectRoute() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <AdminProjectScreen projectId={projectId} />;
}
