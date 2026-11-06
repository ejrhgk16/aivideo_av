export type AdminDailyStat = { date: string; impressions: number; views: number; completions: number; watchSeconds: number };
export type AdminCampaign = {
  id: string; episodeNumber: number; title: string;
  releaseDate: string; durationSeconds: number; pricePoints: number;
  /** Share of views still watching at 0, 5, ..., 100% of the duration. Empty before release. */
  retention: number[];
  daily: AdminDailyStat[];
};
export type AdminProjectStatus = 'LIVE' | 'COMPLETED' | 'SCHEDULED';
export type AdminProject = {
  id: string; title: string; description: string; genre: string; status: AdminProjectStatus; campaigns: AdminCampaign[];
};

export const ADMIN_PROJECT_STATUS_LABELS: Record<AdminProjectStatus, string> = {
  LIVE: '공개 중', COMPLETED: '연재 완료', SCHEDULED: '공개 예정',
};

export const ADMIN_METRICS = {
  impressions: { label: '노출수', definition: '작품·회차 카드가 화면에 50% 이상, 1초 이상 보인 횟수' },
  views: { label: '조회수', definition: '3초 이상 재생된 횟수' },
  viewRate: { label: '조회율', definition: '조회수 ÷ 노출수' },
  avgViewedRate: { label: '평균 시청 비율', definition: '총 시청 시간 ÷ (조회수 × 회차 길이). 조회 1건이 회차의 몇 %를 봤는지의 평균(시청률)이며, TV 시청률과는 다른 지표예요.' },
  completionRate: { label: '완주율', definition: '90% 이상 시청한 조회 ÷ 조회수' },
  exitRate: { label: '이탈률', definition: '1 − 완주율' },
  retention: { label: '구간 이탈 곡선', definition: '회차 길이의 5%마다 아직 시청 중인 조회의 비율(0–100%)' },
} as const;
export type AdminMetricKey = keyof typeof ADMIN_METRICS;
export type AdminKpiKey = Exclude<AdminMetricKey, 'retention'>;

export const ADMIN_RANGES = [7, 28, 90] as const;
export type AdminRangeDays = typeof ADMIN_RANGES[number];
export type AdminDateRange = { start: string; end: string };

export const parseAdminRange = (value?: string): AdminRangeDays =>
  ADMIN_RANGES.find((days) => String(days) === value) ?? 28;

const DAY_MS = 86_400_000;
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
export const dateRange = (days: number, end: string): AdminDateRange => ({ start: addDays(end, 1 - days), end });
export function previousRange({ start, end }: AdminDateRange): AdminDateRange {
  const days = (Date.parse(end) - Date.parse(start)) / DAY_MS + 1;
  return { start: addDays(start, -days), end: addDays(start, -1) };
}

export const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;

export type AdminKpis = {
  impressions: number; views: number; completions: number;
  viewRate: number | null; avgViewedRate: number | null; completionRate: number | null; exitRate: number | null;
};

export function summarize(campaigns: AdminCampaign[], range: AdminDateRange): AdminKpis {
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
    impressions, views, completions,
    viewRate: ratio(views, impressions),
    avgViewedRate: ratio(watchSeconds, viewedDurationSeconds),
    completionRate,
    exitRate: completionRate === null ? null : 1 - completionRate,
  };
}

/** previous is null when nothing was released by the start of the previous period, so there is no fair baseline. */
export function compareKpis(campaigns: AdminCampaign[], days: number, end: string) {
  const range = dateRange(days, end);
  const before = previousRange(range);
  const comparable = campaigns.some((campaign) => campaign.releaseDate <= before.start);
  return { range, current: summarize(campaigns, range), previous: comparable ? summarize(campaigns, before) : null };
}

export type AdminDelta = { text: string; tone: 'good' | 'bad' | 'flat' };
const isCount = (key: AdminKpiKey) => key === 'impressions' || key === 'views';

/** Count metrics change in %, rate metrics in %p. Null when either period has no denominator. */
export function kpiDelta(key: AdminKpiKey, current: AdminKpis, previous: AdminKpis): AdminDelta | null {
  const now = current[key];
  const before = previous[key];
  if (now === null || before === null) return null;
  const change = isCount(key) ? ratio(now - before, before) : now - before;
  if (change === null) return null;
  const shown = Math.abs(change * 100).toFixed(1);
  if (shown === '0.0') return { text: '변동 없음', tone: 'flat' };
  const up = change > 0;
  return { text: `${up ? '▲' : '▼'} ${shown}${isCount(key) ? '%' : '%p'}`, tone: up === (key !== 'exitRate') ? 'good' : 'bad' };
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

export function dailySeries(campaign: AdminCampaign, range: AdminDateRange) {
  const rows = new Map(campaign.daily.map((day) => [day.date, day]));
  const series: { date: string; views: number; viewRate: number | null }[] = [];
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    const day = rows.get(date);
    series.push({ date, views: day?.views ?? 0, viewRate: day ? ratio(day.views, day.impressions) : null });
  }
  return series;
}

export const formatCount = (value: number) => value.toLocaleString('ko-KR');
export const formatRate = (value: number | null) => value === null ? '–' : `${(value * 100).toFixed(1)}%`;
export const formatKpi = (key: AdminKpiKey, kpis: AdminKpis) => isCount(key) ? formatCount(kpis[key] as number) : formatRate(kpis[key]);
export const formatDate = (date: string) => date.replaceAll('-', '.');
export const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
