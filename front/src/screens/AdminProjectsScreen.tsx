import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { AdminKpiGrid, AdminMetricDefinitions, AdminPanel, AdminRangeTabs, AdminShell, AdminTable, type AdminColumn } from '@/components/adminUi';
import { colors } from '@/common/theme/tokens';
import {
  ADMIN_PROJECT_STATUS_LABELS, compareKpis, formatCount, formatRate, parseAdminRange, summarize,
  type AdminKpis, type AdminProject,
} from '@/features/admin/adminMetrics';
import { ADMIN_SAMPLE_PROJECTS, ADMIN_SAMPLE_TODAY } from '@/features/admin/adminSampleData';

type Row = { project: AdminProject; kpis: AdminKpis };

const columns: AdminColumn<Row>[] = [
  { key: 'title', label: '제목', width: 220, flex: true, render: ({ project }) => <View style={styles.titleCell}>
    <View style={styles.poster}><AppText weight="bold" style={styles.posterText}>{project.title[0]}</AppText></View>
    <AppText weight="semibold" numberOfLines={1} style={styles.titleText}>{project.title}</AppText>
  </View> },
  { key: 'status', label: '상태', width: 100, render: ({ project }) => ADMIN_PROJECT_STATUS_LABELS[project.status] },
  { key: 'campaigns', label: '캠페인 수', width: 100, align: 'right', render: ({ project }) => `${project.campaigns.length}개`, sortValue: ({ project }) => project.campaigns.length },
  { key: 'impressions', label: '노출수', width: 120, align: 'right', render: ({ kpis }) => formatCount(kpis.impressions), sortValue: ({ kpis }) => kpis.impressions },
  { key: 'viewRate', label: '조회율', width: 100, align: 'right', render: ({ kpis }) => formatRate(kpis.viewRate), sortValue: ({ kpis }) => kpis.viewRate },
  { key: 'avgViewedRate', label: '평균 시청 비율', width: 130, align: 'right', render: ({ kpis }) => formatRate(kpis.avgViewedRate), sortValue: ({ kpis }) => kpis.avgViewedRate },
  { key: 'exitRate', label: '이탈률', width: 100, align: 'right', render: ({ kpis }) => formatRate(kpis.exitRate), sortValue: ({ kpis }) => kpis.exitRate },
];

export function AdminProjectsScreen() {
  const router = useRouter();
  const days = parseAdminRange(useLocalSearchParams<{ range?: string }>().range);
  const { range, current, previous, rows } = useMemo(() => {
    const comparison = compareKpis(ADMIN_SAMPLE_PROJECTS.flatMap((project) => project.campaigns), days, ADMIN_SAMPLE_TODAY);
    const rows = ADMIN_SAMPLE_PROJECTS.map((project) => ({ project, kpis: summarize(project.campaigns, comparison.range) }));
    return { ...comparison, rows };
  }, [days]);

  return <AdminShell title="프로젝트 목록">
    <AdminRangeTabs value={days} range={range} onChange={(next) => router.setParams({ range: String(next) })} />
    <AdminKpiGrid keys={['impressions', 'views', 'viewRate', 'avgViewedRate', 'exitRate']} current={current} previous={previous} days={days} />
    <AdminPanel title="프로젝트" caption="열 이름을 눌러 정렬하고, 행을 눌러 상세를 확인하세요.">
      <AdminTable columns={columns} rows={rows} rowKey={({ project }) => project.id} rowLabel={({ project }) => project.title} rowAction="상세 보기"
        onRowPress={({ project }) => router.push({ pathname: '/admin/projects/[projectId]', params: { projectId: project.id, range: String(days) } })} />
    </AdminPanel>
    <AdminMetricDefinitions keys={['impressions', 'views', 'viewRate', 'avgViewedRate', 'completionRate', 'exitRate']} />
  </AdminShell>;
}

const styles = StyleSheet.create({
  titleCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  poster: { width: 32, height: 44, borderRadius: 6, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  posterText: { color: colors.accent, fontSize: 15 },
  titleText: { flexShrink: 1, fontSize: 14 },
});
