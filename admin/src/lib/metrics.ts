/**
 * Metric definitions follow the admin metric definition draft v0.1 (2026-11-25, peeka-share/metrics-definition-draft.md);
 * math from the admin prototype spec (_docs/spec/08 on ai/admin-dashboard).
 */

export type DailyStat = {
  date: string;
  impressions: number;
  views: number;
  completions: number;
  watchSeconds: number;
};

/** One campaign (episode) worth of statistics. releaseDate is a KST date; retention is empty before release. */
export type CampaignStats = {
  releaseDate: string | null;
  durationSeconds: number;
  /** Share of views that reached 0, 5, ..., 100% of the duration. */
  retention: number[];
  daily: DailyStat[];
};

export type ContentStatus = "DRAFT" | "REVIEW" | "SCHEDULED" | "PUBLISHED" | "HIDDEN";

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "초안",
  REVIEW: "검토 중",
  SCHEDULED: "공개 예정",
  PUBLISHED: "공개 중",
  HIDDEN: "숨김",
};

export const ADMIN_METRICS = {
  impressions: { label: "노출수", definition: "빼꼼에서 작품의 쇼츠가 화면에 뜬 횟수(작품 단위)" },
  views: { label: "조회수", definition: "본편 회차 재생이 시작된 횟수(유튜브 기준)" },
  viewRate: { label: "조회율", definition: "빼꼼 노출 뒤 24시간 안에 같은 기기에서 그 작품 본편을 재생한 비율" },
  avgViewedRate: {
    label: "평균 시청 비율",
    definition:
      "총 시청 시간 ÷ (조회수 × 회차 길이). 조회 1건의 시청 시간은 회차 길이를 넘지 않게 잘라요. 조회 1건이 회차의 몇 %를 봤는지의 평균(시청률)이며, TV 시청률과는 다른 지표예요.",
  },
  completionRate: { label: "완주율", definition: "회차의 90% 지점까지 도달한 조회 ÷ 조회수" },
  exitRate: { label: "이탈률", definition: "1 − 완주율. 90% 지점까지 도달하지 못한 조회의 비율이에요." },
  retention: {
    label: "구간 이탈 곡선",
    definition: "회차 길이를 5%씩 나눈 21개 점(0–100%)마다 그 지점까지 도달한 조회의 비율",
  },
  quartileReach: {
    label: "구간 도달률",
    definition: "25·50·75·100% 지점까지 도달한 조회의 비율. 구간 이탈 곡선의 같은 지점 값과 같아요.",
  },
} as const;
export type MetricKey = keyof typeof ADMIN_METRICS;
export type KpiKey = Exclude<MetricKey, "retention" | "quartileReach">;

type PageMetrics = { kpis: KpiKey[]; table: KpiKey[]; charts: MetricKey[] };

/**
 * Metrics each page shows as KPI cards, table columns and charts. Impressions are counted per drama,
 * so episode-level views (the campaign page, the project page's campaign table) leave out impressions and view rate.
 */
export const PAGE_METRICS: Record<"projects" | "project" | "campaign", PageMetrics> = {
  projects: {
    kpis: ["impressions", "views", "viewRate", "avgViewedRate", "exitRate"],
    table: ["impressions", "viewRate", "avgViewedRate", "exitRate"],
    charts: [],
  },
  project: {
    kpis: ["impressions", "views", "viewRate", "avgViewedRate", "exitRate"],
    table: ["views", "avgViewedRate", "completionRate", "exitRate"],
    charts: [],
  },
  campaign: {
    kpis: ["views", "avgViewedRate", "completionRate", "exitRate"],
    table: [],
    charts: ["views", "retention", "quartileReach"],
  },
};

/** A page's definitions block lists only the metrics that page shows, in ADMIN_METRICS order. */
export function pageDefinitions(page: keyof typeof PAGE_METRICS): MetricKey[] {
  const { kpis, table, charts } = PAGE_METRICS[page];
  const shown: MetricKey[] = [...kpis, ...table, ...charts];
  return (Object.keys(ADMIN_METRICS) as MetricKey[]).filter((key) => shown.includes(key));
}

export const ADMIN_RANGES = [7, 28, 90] as const;
export type RangeDays = (typeof ADMIN_RANGES)[number];
export type DateRange = { start: string; end: string };

export const parseRange = (value?: string | string[]): RangeDays =>
  ADMIN_RANGES.find((days) => String(days) === value) ?? 28;

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;

/** KST calendar date (YYYY-MM-DD) of a UTC instant. */
export const kstDate = (instant: Date) => new Date(instant.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
/** KST wall time (YYYY-MM-DD HH:mm) of a UTC instant. */
export const kstDateTime = (instant: Date) =>
  new Date(instant.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");

/** Released means publicly visible: PUBLISHED with a publish time that has passed. */
export const releaseDateOf = (status: ContentStatus, publishedAt: Date | null, now: Date) =>
  status === "PUBLISHED" && publishedAt && publishedAt <= now ? kstDate(publishedAt) : null;

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
export const dateRange = (days: number, end: string): DateRange => ({ start: addDays(end, 1 - days), end });
export function previousRange({ start, end }: DateRange): DateRange {
  const days = (Date.parse(end) - Date.parse(start)) / DAY_MS + 1;
  return { start: addDays(start, -days), end: addDays(start, -1) };
}

export const ratio = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : null;

export type Kpis = {
  impressions: number;
  views: number;
  completions: number;
  viewRate: number | null;
  avgViewedRate: number | null;
  completionRate: number | null;
  exitRate: number | null;
};

export function summarize(campaigns: CampaignStats[], range: DateRange): Kpis {
  let impressions = 0, views = 0, completions = 0, watchSeconds = 0, viewedDurationSeconds = 0;
  for (const campaign of campaigns) {
    for (const day of campaign.daily) {
      if (day.date < range.start || day.date > range.end) continue;
      impressions += day.impressions;
      views += day.views;
      completions += day.completions;
      watchSeconds += day.watchSeconds;
      viewedDurationSeconds += day.views * campaign.durationSeconds;
    }
  }
  const completionRate = ratio(completions, views);
  return {
    impressions,
    views,
    completions,
    // Sample stand-in: the defined rate (feed impression → same-device playback within 24h) needs per-impression data.
    viewRate: ratio(views, impressions),
    avgViewedRate: ratio(watchSeconds, viewedDurationSeconds),
    completionRate,
    exitRate: completionRate === null ? null : 1 - completionRate,
  };
}

/** previous is null when nothing was released by the start of the previous period, so there is no fair baseline. */
export function compareKpis(campaigns: CampaignStats[], days: number, end: string) {
  const range = dateRange(days, end);
  const before = previousRange(range);
  const comparable = campaigns.some((campaign) => campaign.releaseDate !== null && campaign.releaseDate <= before.start);
  return { range, current: summarize(campaigns, range), previous: comparable ? summarize(campaigns, before) : null };
}

export type Delta = { text: string; tone: "good" | "bad" | "flat" };
const isCount = (key: KpiKey) => key === "impressions" || key === "views";

/** Count metrics change in %, rate metrics in %p. Null when either period has no denominator. */
export function kpiDelta(key: KpiKey, current: Kpis, previous: Kpis): Delta | null {
  const now = current[key];
  const before = previous[key];
  if (now === null || before === null) return null;
  const change = isCount(key) ? ratio(now - before, before) : now - before;
  if (change === null) return null;
  const shown = Math.abs(change * 100).toFixed(1);
  if (shown === "0.0") return { text: "변동 없음", tone: "flat" };
  const up = change > 0;
  return {
    text: `${up ? "▲" : "▼"} ${shown}${isCount(key) ? "%" : "%p"}`,
    tone: up === (key !== "exitRate") ? "good" : "bad",
  };
}

export function steepestDrop(retention: number[]) {
  let steepest: { from: number; to: number; drop: number } | null = null;
  for (let index = 1; index < retention.length; index += 1) {
    const drop = retention[index - 1] - retention[index];
    if (!steepest || drop > steepest.drop) steepest = { from: (index - 1) * 5, to: index * 5, drop };
  }
  return steepest;
}

export const quartileReach = (retention: number[]) =>
  [25, 50, 75, 100].map((point) => ({ point, reach: retention[point / 5] ?? null }));

/** Trapezoid area under the curve = expected share of the episode watched per view. */
export const retentionArea = (retention: number[]) =>
  retention.slice(1).reduce((area, value, index) => area + (retention[index] + value) / 2 / (retention.length - 1), 0);

export function dailySeries(campaign: CampaignStats, range: DateRange) {
  const rows = new Map(campaign.daily.map((day) => [day.date, day]));
  const series: { date: string; views: number }[] = [];
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    series.push({ date, views: rows.get(date)?.views ?? 0 });
  }
  return series;
}

export const formatCount = (value: number) => value.toLocaleString("ko-KR");
export const formatRate = (value: number | null) => (value === null ? "–" : `${(value * 100).toFixed(1)}%`);
export const formatKpi = (key: KpiKey, kpis: Kpis) =>
  isCount(key) ? formatCount(kpis[key] as number) : formatRate(kpis[key]);
export const formatDate = (date: string) => date.replaceAll("-", ".");
export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Status label as users see it: PUBLISHED with a publish time still ahead is not public yet. */
export const statusLabel = (status: ContentStatus, publishedAt: Date | null, now: Date) =>
  status === "PUBLISHED" && publishedAt && publishedAt > now ? CONTENT_STATUS_LABELS.SCHEDULED : CONTENT_STATUS_LABELS[status];
