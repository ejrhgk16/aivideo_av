import { useLocalSearchParams } from 'expo-router';
import { AdminUploadScreen } from '@/screens/AdminUploadScreen';

export default function AdminUploadRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  return <AdminUploadScreen key={projectId ?? 'new'} projectId={projectId} />;
}
