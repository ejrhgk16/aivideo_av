import { useLocalSearchParams } from 'expo-router';
import { AdminCampaignScreen } from '@/screens/AdminCampaignScreen';

export default function AdminCampaignRoute() {
  const { campaignId } = useLocalSearchParams<{ campaignId: string }>();
  return <AdminCampaignScreen campaignId={campaignId} />;
}
