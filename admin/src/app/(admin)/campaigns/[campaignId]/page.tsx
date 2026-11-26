import { DailyChart, Meter, RetentionChart } from "@/components/charts";
import { EmptyState, KpiGrid, MetricDefinitions, Page, Panel, RangeTabs } from "@/components/ui";
import ui from "@/components/ui.module.css";
import { requireOperator } from "@/lib/auth";
import { getCampaign } from "@/lib/catalog";
import {
  PAGE_METRICS,
  statusLabel,
  compareKpis,
  dailySeries,
  formatCount,
  formatDate,
  formatDuration,
  kstDate,
  kstDateTime,
  pageDefinitions,
  parseRange,
  quartileReach,
  releaseDateOf,
} from "@/lib/metrics";
import { statsForCampaign } from "@/lib/sampleMetrics";

export default async function CampaignPage({ params, searchParams }: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOperator();
  const { campaignId } = await params;
  const days = parseRange((await searchParams).range);
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return (
      <Page title="캠페인" breadcrumb={[{ label: "프로젝트 목록", href: `/?range=${days}` }]}>
        <EmptyState
          title="캠페인을 찾을 수 없어요"
          description="주소가 바뀌었거나 없는 캠페인이에요."
          actionHref="/"
          actionLabel="프로젝트 목록으로"
        />
      </Page>
    );
  }

  const now = new Date();
  const today = kstDate(now);
  const stats = statsForCampaign(campaign, now);
  const { range, current, previous } = compareKpis([stats], days, today);
  const releaseDate = releaseDateOf(campaign.status, campaign.publishedAt, now);
  const release = releaseDate
    ? `공개일 ${formatDate(releaseDate)}`
    : `${statusLabel(campaign.status, campaign.publishedAt, now)}${campaign.publishedAt ? ` ${formatDate(kstDateTime(campaign.publishedAt))}` : ""}`;
  const price = campaign.pricePoints ? `${formatCount(campaign.pricePoints)} P` : "무료";
  const episode = `${campaign.episodeNumber}화`;
  const notReleased = <p className={ui.muted}>아직 공개 전이라 시청 데이터가 없어요.</p>;

  return (
    <Page
      title={campaign.title && campaign.title !== episode ? `${episode} ${campaign.title}` : episode}
      breadcrumb={[
        { label: "프로젝트 목록", href: `/?range=${days}` },
        { label: campaign.project.title, href: `/projects/${campaign.project.uuid}?range=${days}` },
        { label: episode },
      ]}
    >
      <p className={ui.muted}>
        {`${release} · 길이 ${formatDuration(Math.round(campaign.durationMs / 1000))} · ${price}`}
      </p>
      <RangeTabs value={days} range={range} basePath={`/campaigns/${campaign.uuid}`} />
      <KpiGrid keys={PAGE_METRICS.campaign.kpis} current={current} previous={previous} days={days} />
      <Panel title="일별 조회수" caption="막대를 누르거나 가리키면 그날의 값을 볼 수 있어요.">
        {/* key resets the chosen day when the range changes. */}
        {releaseDate ? <DailyChart key={days} series={dailySeries(stats, range)} /> : notReleased}
      </Panel>
      <Panel title="구간 이탈 곡선" caption="공개 이후 전체 기간 기준 · 회차 길이의 5%마다 그 지점까지 도달한 조회 비율">
        {releaseDate ? <RetentionChart points={stats.retention} /> : notReleased}
      </Panel>
      <Panel title="구간 도달률" caption="공개 이후 전체 기간 기준 · 그 지점까지 도달한 조회 비율">
        {releaseDate
          ? quartileReach(stats.retention).map(({ point, reach }) => (
              <Meter key={point} label={`${point}% 지점`} value={reach} />
            ))
          : notReleased}
      </Panel>
      <MetricDefinitions keys={pageDefinitions("campaign")} />
    </Page>
  );
}
