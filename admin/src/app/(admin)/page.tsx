import { DataTable, type TableColumn, type TableRow } from "@/components/DataTable";
import { EmptyState, KpiGrid, MetricDefinitions, Page, Panel, RangeTabs } from "@/components/ui";
import { requireOperator } from "@/lib/auth";
import { listProjects } from "@/lib/catalog";
import {
  ADMIN_METRICS,
  PAGE_METRICS,
  statusLabel,
  compareKpis,
  formatKpi,
  kstDate,
  pageDefinitions,
  parseRange,
  summarize,
} from "@/lib/metrics";
import { statsForCampaign } from "@/lib/sampleMetrics";

const { kpis: kpiKeys, table: metricKeys } = PAGE_METRICS.projects;
const columns: TableColumn[] = [
  { key: "title", label: "제목" },
  { key: "status", label: "상태" },
  { key: "campaigns", label: "캠페인 수", align: "right", sortable: true },
  ...metricKeys.map((key): TableColumn => ({ key, label: ADMIN_METRICS[key].label, align: "right", sortable: true })),
];

export default async function ProjectsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOperator();
  const days = parseRange((await searchParams).range);
  const now = new Date();
  const today = kstDate(now);
  const projects = (await listProjects()).map((project) => ({
    project,
    stats: project.campaigns.map((campaign) => statsForCampaign(campaign, now)),
  }));
  const { range, current, previous } = compareKpis(projects.flatMap(({ stats }) => stats), days, today);
  const rows: TableRow[] = projects.map(({ project, stats }) => {
    const kpis = summarize(stats, range);
    return {
      key: project.uuid,
      href: `/projects/${project.uuid}?range=${days}`,
      cells: {
        title: { text: project.title, lead: project.title[0] },
        status: { text: statusLabel(project.status, project.publishedAt, now) },
        campaigns: { text: `${project.campaigns.length}개`, sort: project.campaigns.length },
        ...Object.fromEntries(metricKeys.map((key) => [key, { text: formatKpi(key, kpis), sort: kpis[key] }])),
      },
    };
  });

  return (
    <Page title="프로젝트 목록">
      <RangeTabs value={days} range={range} basePath="/" />
      <KpiGrid keys={kpiKeys} current={current} previous={previous} days={days} />
      {rows.length ? (
        <Panel title="프로젝트" caption="열 이름을 눌러 정렬하고, 행을 눌러 상세를 확인하세요.">
          <DataTable columns={columns} rows={rows} caption={`프로젝트 ${rows.length}개 · 지표는 최근 ${days}일 기준`} />
        </Panel>
      ) : (
        <EmptyState
          title="아직 프로젝트가 없어요"
          description="새 업로드에서 첫 프로젝트와 캠페인을 등록하세요."
          actionHref={`/upload?range=${days}`}
          actionLabel="새 업로드"
        />
      )}
      <MetricDefinitions keys={pageDefinitions("projects")} />
    </Page>
  );
}
