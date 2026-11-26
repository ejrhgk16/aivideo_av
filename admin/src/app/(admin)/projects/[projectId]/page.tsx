import Link from "next/link";

import { DataTable, type TableColumn, type TableRow } from "@/components/DataTable";
import { Icon } from "@/components/Icon";
import { EmptyState, KpiGrid, MetricDefinitions, Page, Panel, RangeTabs } from "@/components/ui";
import ui from "@/components/ui.module.css";
import { requireOperator } from "@/lib/auth";
import { getProject } from "@/lib/catalog";
import {
  ADMIN_METRICS,
  PAGE_METRICS,
  statusLabel,
  compareKpis,
  formatCount,
  formatDate,
  formatDuration,
  formatKpi,
  kstDate,
  pageDefinitions,
  parseRange,
  releaseDateOf,
  summarize,
} from "@/lib/metrics";
import { statsForCampaign } from "@/lib/sampleMetrics";

const { kpis: kpiKeys, table: metricKeys } = PAGE_METRICS.project;
const columns: TableColumn[] = [
  { key: "episode", label: "회차 번호", align: "right", sortable: true },
  { key: "title", label: "캠페인 제목" },
  { key: "release", label: "공개일" },
  { key: "duration", label: "길이", align: "right", sortable: true },
  { key: "price", label: "가격", align: "right", sortable: true },
  ...metricKeys.map((key): TableColumn => ({ key, label: ADMIN_METRICS[key].label, align: "right", sortable: true })),
];

export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOperator();
  const { projectId } = await params;
  const days = parseRange((await searchParams).range);
  const project = await getProject(projectId);
  if (!project) {
    return (
      <Page title="프로젝트" breadcrumb={[{ label: "프로젝트 목록", href: `/?range=${days}` }]}>
        <EmptyState
          title="프로젝트를 찾을 수 없어요"
          description="주소가 바뀌었거나 없는 프로젝트예요."
          actionHref={`/?range=${days}`}
          actionLabel="프로젝트 목록으로"
        />
      </Page>
    );
  }

  const now = new Date();
  const today = kstDate(now);
  const campaigns = project.campaigns.map((campaign) => ({ campaign, stats: statsForCampaign(campaign, now) }));
  const { range, current, previous } = compareKpis(campaigns.map(({ stats }) => stats), days, today);
  const rows: TableRow[] = campaigns.map(({ campaign, stats }) => {
    const kpis = summarize([stats], range);
    const releaseDate = releaseDateOf(campaign.status, campaign.publishedAt, now);
    const status = statusLabel(campaign.status, campaign.publishedAt, now);
    return {
      key: campaign.uuid,
      href: `/campaigns/${campaign.uuid}?range=${days}`,
      cells: {
        episode: { text: `${campaign.episodeNumber}화`, sort: campaign.episodeNumber },
        title: { text: campaign.title ?? `${campaign.episodeNumber}화` },
        release: {
          text: releaseDate
            ? formatDate(releaseDate)
            : campaign.publishedAt
              ? `${status} · ${formatDate(kstDate(campaign.publishedAt))}`
              : status,
        },
        duration: { text: formatDuration(Math.round(campaign.durationMs / 1000)), sort: campaign.durationMs },
        price: {
          text: campaign.pricePoints ? `${formatCount(campaign.pricePoints)} P` : "무료",
          sort: campaign.pricePoints,
        },
        ...Object.fromEntries(metricKeys.map((key) => [key, { text: formatKpi(key, kpis), sort: kpis[key] }])),
      },
    };
  });
  // filter(Boolean) drops the genre part when a project has no genres yet.
  const summary = [
    statusLabel(project.status, project.publishedAt, now),
    project.genres.join(", "),
    `캠페인 ${project.campaigns.length}개`,
    project.companyName,
  ].filter(Boolean).join(" · ");

  return (
    <Page
      title={project.title}
      breadcrumb={[{ label: "프로젝트 목록", href: `/?range=${days}` }, { label: project.title }]}
      actions={
        <Link href={`/upload?projectId=${project.uuid}&range=${days}`} className={ui.button}>
          <Icon name="plus" />
          캠페인 추가
        </Link>
      }
    >
      <p className={ui.muted}>{summary}</p>
      <p>{project.synopsis || project.shortDescription}</p>
      <RangeTabs value={days} range={range} basePath={`/projects/${project.uuid}`} />
      <KpiGrid keys={kpiKeys} current={current} previous={previous} days={days} />
      <Panel
        title="캠페인"
        caption={rows.length ? "열 이름을 눌러 정렬하고, 행을 눌러 캠페인 대시보드를 확인하세요." : undefined}
      >
        {rows.length ? (
          <DataTable columns={columns} rows={rows} caption={`캠페인 ${rows.length}개 · 지표는 최근 ${days}일 기준`} />
        ) : (
          <p className={ui.muted}>아직 캠페인이 없어요. 캠페인 추가로 첫 회차를 올려 주세요.</p>
        )}
      </Panel>
      <MetricDefinitions keys={pageDefinitions("project")} />
    </Page>
  );
}
