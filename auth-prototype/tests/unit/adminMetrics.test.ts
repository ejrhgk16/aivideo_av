import {
  addDays, compareKpis, dailySeries, dateRange, formatKpi, formatRate, kpiDelta, parseAdminRange, previousRange,
  quartileReach, retentionArea, steepestDrop, summarize, type AdminCampaign, type AdminDailyStat,
} from '@/features/admin/adminMetrics';
import { ADMIN_SAMPLE_PROJECTS, ADMIN_SAMPLE_TODAY, findAdminCampaign, findAdminProject } from '@/features/admin/adminSampleData';

const day = (date: string, impressions: number, views: number, completions: number, watchSeconds: number): AdminDailyStat =>
  ({ date, impressions, views, completions, watchSeconds });
const campaign = (daily: AdminDailyStat[], durationSeconds = 60): AdminCampaign => ({
  id: 'c', episodeNumber: 1, title: '테스트', releaseDate: daily[0]?.date ?? '2026-11-01',
  durationSeconds, pricePoints: 0, retention: [], daily,
});

test('rates follow the metric definitions', () => {
  const kpis = summarize([campaign([day('2026-11-05', 1000, 300, 120, 9000)])], { start: '2026-11-05', end: '2026-11-05' });
  expect(kpis).toMatchObject({ impressions: 1000, views: 300, viewRate: 0.3, avgViewedRate: 0.5, completionRate: 0.4 });
  expect(kpis.exitRate).toBeCloseTo(0.6);
});

test('avg % viewed weights each campaign by its own duration', () => {
  const kpis = summarize([
    campaign([day('2026-11-05', 100, 10, 0, 300)], 60),
    campaign([day('2026-11-05', 100, 10, 0, 1200)], 120),
  ], { start: '2026-11-05', end: '2026-11-05' });
  expect(kpis.avgViewedRate).toBeCloseTo(1500 / (10 * 60 + 10 * 120));
});

test('zero denominators produce null rates and display as a dash', () => {
  const empty = summarize([campaign([day('2026-11-05', 0, 0, 0, 0)])], { start: '2026-11-05', end: '2026-11-05' });
  expect(empty).toMatchObject({ viewRate: null, avgViewedRate: null, completionRate: null, exitRate: null });
  for (const key of ['viewRate', 'avgViewedRate', 'completionRate', 'exitRate'] as const) expect(formatKpi(key, empty)).toBe('–');
  expect(formatKpi('impressions', empty)).toBe('0');
  expect(formatRate(null)).toBe('–');
  expect(kpiDelta('impressions', empty, empty)).toBeNull();
  expect(kpiDelta('viewRate', empty, empty)).toBeNull();
});

test('ranges are inclusive and the previous period has equal length', () => {
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(dateRange(7, '2026-11-05')).toEqual({ start: '2026-10-30', end: '2026-11-05' });
  expect(previousRange({ start: '2026-10-30', end: '2026-11-05' })).toEqual({ start: '2026-10-23', end: '2026-10-29' });
  expect(parseAdminRange('90')).toBe(90);
  expect(parseAdminRange('5')).toBe(28);
  expect(parseAdminRange(undefined)).toBe(28);

  const rows = [day('2026-10-22', 1, 1, 0, 1), day('2026-10-23', 10, 2, 1, 60), day('2026-10-29', 10, 2, 1, 60),
    day('2026-10-30', 100, 30, 10, 900), day('2026-11-05', 100, 30, 10, 900), day('2026-11-06', 999, 999, 0, 0)];
  const { range, current, previous: maybePrevious } = compareKpis([campaign(rows)], 7, '2026-11-05');
  const previous = maybePrevious!;
  expect(range).toEqual({ start: '2026-10-30', end: '2026-11-05' });
  expect(current).toMatchObject({ impressions: 200, views: 60, completions: 20 });
  expect(previous).toMatchObject({ impressions: 20, views: 4, completions: 2 });
  expect(kpiDelta('impressions', current, previous)).toEqual({ text: '▲ 900.0%', tone: 'good' });
  expect(kpiDelta('viewRate', current, previous)).toEqual({ text: '▲ 10.0%p', tone: 'good' });
  expect(kpiDelta('completionRate', current, previous)).toEqual({ text: '▼ 16.7%p', tone: 'bad' });
  expect(kpiDelta('exitRate', current, previous)).toEqual({ text: '▲ 16.7%p', tone: 'bad' });
  expect(kpiDelta('exitRate', previous, current)).toEqual({ text: '▼ 16.7%p', tone: 'good' });
  expect(kpiDelta('views', current, current)).toEqual({ text: '변동 없음', tone: 'flat' });
});

test('a campaign released during the previous period has no comparison baseline', () => {
  const late = campaign([day('2026-10-25', 10, 2, 1, 60), day('2026-11-05', 100, 30, 10, 900)]);
  expect(compareKpis([late], 7, '2026-11-05').previous).toBeNull();
});

test('daily series covers every day of the range, with null rates on empty days', () => {
  const series = dailySeries(campaign([day('2026-11-04', 100, 25, 0, 0)]), { start: '2026-11-03', end: '2026-11-05' });
  expect(series).toEqual([
    { date: '2026-11-03', views: 0, viewRate: null },
    { date: '2026-11-04', views: 25, viewRate: 0.25 },
    { date: '2026-11-05', views: 0, viewRate: null },
  ]);
});

test('steepest drop picks the first largest segment; quartiles read the curve', () => {
  const curve = [1, 0.95, 0.75, 0.55, 0.5];
  expect(steepestDrop(curve)).toEqual({ from: 5, to: 10, drop: expect.closeTo(0.2) });
  expect(steepestDrop([])).toBeNull();
  const full = Array.from({ length: 21 }, (_, index) => 1 - index * 0.04);
  expect(quartileReach(full)).toEqual([
    { point: 25, reach: full[5] }, { point: 50, reach: full[10] }, { point: 75, reach: full[15] }, { point: 100, reach: full[20] },
  ]);
  expect(quartileReach([]).map(({ reach }) => reach)).toEqual([null, null, null, null]);
  expect(retentionArea(full)).toBeCloseTo(0.6);
});

describe('sample data', () => {
  const campaigns = ADMIN_SAMPLE_PROJECTS.flatMap((project) => project.campaigns);

  test('has 3-4 projects with 6-12 campaigns and 90+ days of daily rows', () => {
    expect(ADMIN_SAMPLE_PROJECTS.length).toBeGreaterThanOrEqual(3);
    expect(ADMIN_SAMPLE_PROJECTS.length).toBeLessThanOrEqual(4);
    for (const project of ADMIN_SAMPLE_PROJECTS) {
      expect(project.campaigns.length).toBeGreaterThanOrEqual(6);
      expect(project.campaigns.length).toBeLessThanOrEqual(12);
    }
    const dates = new Set(campaigns.flatMap((item) => item.daily.map((row) => row.date)));
    expect(dates.size).toBeGreaterThanOrEqual(180);
    expect([...dates].every((date) => date <= ADMIN_SAMPLE_TODAY)).toBe(true);
    expect(compareKpis(campaigns, 90, ADMIN_SAMPLE_TODAY).previous?.impressions).toBeGreaterThan(0);
  });

  test('is internally consistent', () => {
    for (const item of campaigns) {
      for (const row of item.daily) {
        expect(row.views).toBeLessThanOrEqual(row.impressions);
        expect(row.completions).toBeLessThanOrEqual(row.views);
        expect(row.date >= item.releaseDate).toBe(true);
      }
      if (item.daily.length === 0) {
        expect(item.retention).toEqual([]);
        continue;
      }
      expect(item.retention).toHaveLength(21);
      expect(item.retention[0]).toBe(1);
      item.retention.slice(1).forEach((value, index) => expect(value).toBeLessThanOrEqual(item.retention[index]));
      const lifetime = summarize([item], { start: '2000-01-01', end: ADMIN_SAMPLE_TODAY });
      expect(Math.abs(lifetime.completionRate! - item.retention[18])).toBeLessThan(0.01);
      expect(Math.abs(lifetime.avgViewedRate! - retentionArea(item.retention))).toBeLessThan(0.01);
    }
  });

  test('is deterministic and resolvable by id', () => {
    let reloaded: typeof ADMIN_SAMPLE_PROJECTS = [];
    jest.isolateModules(() => { reloaded = require('@/features/admin/adminSampleData').ADMIN_SAMPLE_PROJECTS; });
    expect(reloaded).toEqual(ADMIN_SAMPLE_PROJECTS);
    expect(findAdminProject(ADMIN_SAMPLE_PROJECTS[0].id)).toBe(ADMIN_SAMPLE_PROJECTS[0]);
    expect(findAdminCampaign(campaigns[0].id)?.campaign).toBe(campaigns[0]);
    expect(findAdminProject('missing')).toBeNull();
    expect(findAdminCampaign('missing')).toBeNull();
  });
});
