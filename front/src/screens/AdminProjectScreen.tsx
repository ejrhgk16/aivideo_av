import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, EmptyState, Icon } from '@/components/ui';
import { AdminKpiGrid, AdminMetricDefinitions, AdminPanel, AdminRangeTabs, AdminShell, AdminTable, type AdminColumn } from '@/components/adminUi';
import { colors } from '@/common/theme/tokens';
import {
  ADMIN_PROJECT_STATUS_LABELS, compareKpis, formatCount, formatDate, formatDuration, formatRate, parseAdminRange, summarize,
  type AdminCampaign, type AdminKpis,
} from '@/features/admin/adminMetrics';
import { ADMIN_SAMPLE_TODAY, findAdminProject } from '@/features/admin/adminSampleData';

type Row = { campaign: AdminCampaign; kpis: AdminKpis };

const columns: AdminColumn<Row>[] = [
  { key: 'episode', label: '회차 번호', width: 80, align: 'right', render: ({ campaign }) => `${campaign.episodeNumber}화`, sortValue: ({ campaign }) => campaign.episodeNumber },
  { key: 'title', label: '캠페인 제목', width: 140, flex: true, render: ({ campaign }) => campaign.title },
  { key: 'release', label: '공개일', width: 96, render: ({ campaign }) => formatDate(campaign.releaseDate) },
  { key: 'duration', label: '길이', width: 60, align: 'right', render: ({ campaign }) => formatDuration(campaign.durationSeconds), sortValue: ({ campaign }) => campaign.durationSeconds },
  { key: 'impressions', label: '노출수', width: 96, align: 'right', render: ({ kpis }) => formatCount(kpis.impressions), sortValue: ({ kpis }) => kpis.impressions },
  { key: 'views', label: '조회수', width: 88, align: 'right', render: ({ kpis }) => formatCount(kpis.views), sortValue: ({ kpis }) => kpis.views },
  { key: 'viewRate', label: '조회율', width: 76, align: 'right', render: ({ kpis }) => formatRate(kpis.viewRate), sortValue: ({ kpis }) => kpis.viewRate },
  { key: 'avgViewedRate', label: '평균 시청 비율', width: 104, align: 'right', render: ({ kpis }) => formatRate(kpis.avgViewedRate), sortValue: ({ kpis }) => kpis.avgViewedRate },
  { key: 'completionRate', label: '완주율', width: 76, align: 'right', render: ({ kpis }) => formatRate(kpis.completionRate), sortValue: ({ kpis }) => kpis.completionRate },
  { key: 'exitRate', label: '이탈률', width: 76, align: 'right', render: ({ kpis }) => formatRate(kpis.exitRate), sortValue: ({ kpis }) => kpis.exitRate },
];

export function AdminProjectScreen({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const days = parseAdminRange(useLocalSearchParams<{ range?: string }>().range);
  const project = findAdminProject(projectId);
  const data = useMemo(() => {
    if (!project) return null;
    const comparison = compareKpis(project.campaigns, days, ADMIN_SAMPLE_TODAY);
    const rows = project.campaigns.map((campaign) => ({ campaign, kpis: summarize([campaign], comparison.range) }));
    return { ...comparison, rows };
  }, [project, days]);

  if (!project || !data) return <AdminShell title="프로젝트" breadcrumb={[{ label: '프로젝트 목록', href: '/admin' }]}>
    <EmptyState title="프로젝트를 찾을 수 없어요" description="주소가 바뀌었거나 없는 프로젝트예요."
      action="프로젝트 목록으로" onAction={() => router.replace('/admin')} />
  </AdminShell>;

  return <AdminShell title={project.title}
    breadcrumb={[{ label: '프로젝트 목록', href: { pathname: '/admin', params: { range: String(days) } } }, { label: project.title }]}
    actions={<Button label="캠페인 추가" icon={<Icon name="plus" size={18} color={colors.background} />}
      onPress={() => router.push({ pathname: '/admin/upload', params: { projectId: project.id } })} />}>
    <AppText style={{ color: colors.muted }}>
      {`${ADMIN_PROJECT_STATUS_LABELS[project.status]} · ${project.genre} · 캠페인 ${project.campaigns.length}개`}
    </AppText>
    <AppText>{project.description}</AppText>
    <AdminRangeTabs value={days} range={data.range} onChange={(next) => router.setParams({ range: String(next) })} />
    <AdminKpiGrid keys={['impressions', 'views', 'viewRate', 'avgViewedRate', 'exitRate']} current={data.current} previous={data.previous} days={days} />
    <AdminPanel title="캠페인" caption="열 이름을 눌러 정렬하고, 행을 눌러 캠페인 대시보드를 확인하세요.">
      <AdminTable columns={columns} rows={data.rows} rowKey={({ campaign }) => campaign.id}
        rowLabel={({ campaign }) => `${campaign.episodeNumber}화 ${campaign.title}`} rowAction="대시보드 보기"
        onRowPress={({ campaign }) => router.push({ pathname: '/admin/campaigns/[campaignId]', params: { campaignId: campaign.id, range: String(days) } })} />
    </AdminPanel>
    <AdminMetricDefinitions keys={['impressions', 'views', 'viewRate', 'avgViewedRate', 'completionRate', 'exitRate']} />
  </AdminShell>;
}
