import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, EmptyState } from '@/components/ui';
import {
  AdminBarChart, AdminKpiGrid, AdminMeter, AdminMetricDefinitions, AdminPanel, AdminRangeTabs, AdminRetentionChart, AdminShell,
} from '@/components/adminUi';
import { colors } from '@/common/theme/tokens';
import {
  compareKpis, dailySeries, formatCount, formatDate, formatDuration, formatRate, parseAdminRange, quartileReach, steepestDrop,
} from '@/features/admin/adminMetrics';
import { ADMIN_SAMPLE_TODAY, findAdminCampaign } from '@/features/admin/adminSampleData';

export function AdminCampaignScreen({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const days = parseAdminRange(useLocalSearchParams<{ range?: string }>().range);
  const data = useMemo(() => {
    const found = findAdminCampaign(campaignId);
    if (!found) return null;
    const comparison = compareKpis([found.campaign], days, ADMIN_SAMPLE_TODAY);
    const bars = dailySeries(found.campaign, comparison.range).map((day) => ({
      label: formatDate(day.date).slice(5), value: day.views, marker: day.viewRate,
      summary: `${formatDate(day.date)} · 조회수 ${formatCount(day.views)} · 조회율 ${formatRate(day.viewRate)}`,
    }));
    return { ...found, ...comparison, bars, drop: steepestDrop(found.campaign.retention) };
  }, [campaignId, days]);

  if (!data) return <AdminShell title="캠페인" breadcrumb={[{ label: '프로젝트 목록', href: '/admin' }]}>
    <EmptyState title="캠페인을 찾을 수 없어요" description="주소가 바뀌었거나 없는 캠페인이에요."
      action="프로젝트 목록으로" onAction={() => router.replace('/admin')} />
  </AdminShell>;

  const { project, campaign } = data;
  const rangeParams = { range: String(days) };
  const released = campaign.retention.length > 0;
  const notReleased = <AppText style={{ color: colors.muted }}>아직 공개 전이라 시청 데이터가 없어요.</AppText>;
  return <AdminShell title={`${campaign.episodeNumber}화 ${campaign.title}`} breadcrumb={[
    { label: '프로젝트 목록', href: { pathname: '/admin', params: rangeParams } },
    { label: project.title, href: { pathname: '/admin/projects/[projectId]', params: { projectId: project.id, ...rangeParams } } },
    { label: `${campaign.episodeNumber}화` },
  ]}>
    <AppText style={{ color: colors.muted }}>
      {`${released ? '공개일' : '공개 예정'} ${formatDate(campaign.releaseDate)} · 길이 ${formatDuration(campaign.durationSeconds)} · ${campaign.pricePoints ? `${campaign.pricePoints} P` : '무료'}`}
    </AppText>
    <AdminRangeTabs value={days} range={data.range} onChange={(next) => router.setParams({ range: String(next) })} />
    <AdminKpiGrid keys={['impressions', 'views', 'viewRate', 'avgViewedRate', 'completionRate', 'exitRate']}
      current={data.current} previous={data.previous} days={days} />
    <AdminPanel title="일별 조회수 · 조회율" caption="막대를 누르면 그날의 값을 볼 수 있어요.">
      {released ? <AdminBarChart key={days} bars={data.bars} /> : notReleased}
    </AdminPanel>
    <AdminPanel title="구간 이탈 곡선" caption="공개 이후 전체 기간 기준 · 회차 길이의 5%마다 아직 시청 중인 조회 비율">
      {data.drop ? <>
        <AppText weight="semibold" style={{ color: colors.danger }}>
          {`${data.drop.from}–${data.drop.to}% 구간에서 가장 많이 이탈 (−${Math.round(data.drop.drop * 100)}%p)`}
        </AppText>
        <AdminRetentionChart points={campaign.retention} highlight={data.drop} />
      </> : notReleased}
    </AdminPanel>
    <AdminPanel title="구간 도달률" caption="공개 이후 전체 기간 기준 · 조회 중 해당 지점까지 시청한 비율">
      {released ? quartileReach(campaign.retention).map(({ point, reach }) => <AdminMeter key={point} label={`${point}%`} value={reach} />) : notReleased}
    </AdminPanel>
    <AdminMetricDefinitions keys={['impressions', 'views', 'viewRate', 'avgViewedRate', 'completionRate', 'exitRate', 'retention']} />
  </AdminShell>;
}
