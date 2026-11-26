import { describe, expect, it } from "vitest";
import {
  ADMIN_METRICS,
  PAGE_METRICS,
  addDays,
  compareKpis,
  dailySeries,
  dateRange,
  formatCount,
  formatDate,
  formatDuration,
  formatKpi,
  formatRate,
  kpiDelta,
  kstDate,
  kstDateTime,
  pageDefinitions,
  parseRange,
  previousRange,
  quartileReach,
  releaseDateOf,
  retentionArea,
  steepestDrop,
  summarize,
  type CampaignStats,
  type DailyStat,
} from "@/lib/metrics";

const day = (date: string, impressions: number, views: number, completions: number, watchSeconds: number): DailyStat => ({
  date,
  impressions,
  views,
  completions,
  watchSeconds,
});
const stats = (
  daily: DailyStat[],
  durationSeconds = 60,
  releaseDate: string | null = daily[0]?.date ?? "2026-11-01",
): CampaignStats => ({ releaseDate, durationSeconds, retention: [], daily });

describe("metrics", () => {
  it("rates follow the metric definitions", () => {
    const kpis = summarize([stats([day("2026-11-05", 1000, 300, 120, 9000)])], { start: "2026-11-05", end: "2026-11-05" });
    expect(kpis).toMatchObject({ impressions: 1000, views: 300, viewRate: 0.3, avgViewedRate: 0.5, completionRate: 0.4 });
    expect(kpis.exitRate).toBeCloseTo(0.6);
  });

  it("avg % viewed weights each campaign by its own duration", () => {
    const kpis = summarize(
      [stats([day("2026-11-05", 100, 10, 0, 300)], 60), stats([day("2026-11-05", 100, 10, 0, 1200)], 120)],
      { start: "2026-11-05", end: "2026-11-05" },
    );
    expect(kpis.avgViewedRate).toBeCloseTo(1500 / (10 * 60 + 10 * 120));
  });

  it("zero denominators produce null rates and display as a dash", () => {
    const empty = summarize([stats([day("2026-11-05", 0, 0, 0, 0)])], { start: "2026-11-05", end: "2026-11-05" });
    expect(empty).toMatchObject({ viewRate: null, avgViewedRate: null, completionRate: null, exitRate: null });
    for (const key of ["viewRate", "avgViewedRate", "completionRate", "exitRate"] as const) {
      expect(formatKpi(key, empty)).toBe("–");
    }
    expect(formatKpi("impressions", empty)).toBe("0");
    expect(formatRate(null)).toBe("–");
    expect(kpiDelta("impressions", empty, empty)).toBeNull();
    expect(kpiDelta("viewRate", empty, empty)).toBeNull();
  });

  it("ranges are inclusive and the previous period has equal length", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(dateRange(7, "2026-11-05")).toEqual({ start: "2026-10-30", end: "2026-11-05" });
    expect(previousRange({ start: "2026-10-30", end: "2026-11-05" })).toEqual({ start: "2026-10-23", end: "2026-10-29" });
    expect(parseRange("90")).toBe(90);
    expect(parseRange("5")).toBe(28);
    expect(parseRange(undefined)).toBe(28);
    expect(parseRange(["7", "90"])).toBe(28);

    const rows = [
      day("2026-10-22", 1, 1, 0, 1),
      day("2026-10-23", 10, 2, 1, 60),
      day("2026-10-29", 10, 2, 1, 60),
      day("2026-10-30", 100, 30, 10, 900),
      day("2026-11-05", 100, 30, 10, 900),
      day("2026-11-06", 999, 999, 0, 0),
    ];
    const { range, current, previous: maybePrevious } = compareKpis([stats(rows)], 7, "2026-11-05");
    const previous = maybePrevious!;
    expect(range).toEqual({ start: "2026-10-30", end: "2026-11-05" });
    expect(current).toMatchObject({ impressions: 200, views: 60, completions: 20 });
    expect(previous).toMatchObject({ impressions: 20, views: 4, completions: 2 });
    expect(kpiDelta("impressions", current, previous)).toEqual({ text: "▲ 900.0%", tone: "good" });
    expect(kpiDelta("viewRate", current, previous)).toEqual({ text: "▲ 10.0%p", tone: "good" });
    expect(kpiDelta("completionRate", current, previous)).toEqual({ text: "▼ 16.7%p", tone: "bad" });
    expect(kpiDelta("exitRate", current, previous)).toEqual({ text: "▲ 16.7%p", tone: "bad" });
    expect(kpiDelta("exitRate", previous, current)).toEqual({ text: "▼ 16.7%p", tone: "good" });
    expect(kpiDelta("views", current, current)).toEqual({ text: "변동 없음", tone: "flat" });
  });

  it("has no comparison baseline when nothing was released by the previous period", () => {
    const late = stats([day("2026-10-25", 10, 2, 1, 60), day("2026-11-05", 100, 30, 10, 900)]);
    expect(compareKpis([late], 7, "2026-11-05").previous).toBeNull();
    const unreleased = stats([], 60, null);
    expect(compareKpis([unreleased], 7, "2026-11-05")).toMatchObject({ current: { impressions: 0 }, previous: null });
  });

  it("daily series covers every day of the range with views only, zero on empty days", () => {
    const series = dailySeries(stats([day("2026-11-04", 100, 25, 0, 0)]), { start: "2026-11-03", end: "2026-11-05" });
    expect(series).toEqual([
      { date: "2026-11-03", views: 0 },
      { date: "2026-11-04", views: 25 },
      { date: "2026-11-05", views: 0 },
    ]);
  });

  it("steepest drop picks the first largest segment; quartiles read the curve", () => {
    const curve = [1, 0.95, 0.75, 0.55, 0.5];
    expect(steepestDrop(curve)).toEqual({ from: 5, to: 10, drop: expect.closeTo(0.2) });
    expect(steepestDrop([])).toBeNull();
    const full = Array.from({ length: 21 }, (_, index) => 1 - index * 0.04);
    expect(quartileReach(full)).toEqual([
      { point: 25, reach: full[5] },
      { point: 50, reach: full[10] },
      { point: 75, reach: full[15] },
      { point: 100, reach: full[20] },
    ]);
    expect(quartileReach([]).map(({ reach }) => reach)).toEqual([null, null, null, null]);
    expect(retentionArea(full)).toBeCloseTo(0.6);
  });

  it("formats counts, dates and durations", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(formatDate("2026-11-05")).toBe("2026.11.05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("page metrics", () => {
  it("uses the decided definitions for impressions, views, view rate and reach", () => {
    expect(ADMIN_METRICS.impressions.definition).toBe("빼꼼에서 작품의 쇼츠가 화면에 뜬 횟수(작품 단위)");
    expect(ADMIN_METRICS.views.definition).toBe("본편 회차 재생이 시작된 횟수(유튜브 기준)");
    expect(ADMIN_METRICS.viewRate.definition).toBe(
      "빼꼼 노출 뒤 24시간 안에 같은 기기에서 그 작품 본편을 재생한 비율",
    );
    expect(ADMIN_METRICS.retention.definition).toContain("그 지점까지 도달한 조회의 비율");
    expect(ADMIN_METRICS.quartileReach.definition).toContain("25·50·75·100% 지점까지 도달한 조회의 비율");
  });

  it("shows impressions and view rate only at drama level", () => {
    const dramaLevel = ["impressions", "viewRate"];
    expect(PAGE_METRICS.projects.kpis).toEqual(expect.arrayContaining(dramaLevel));
    expect(PAGE_METRICS.project.kpis).toEqual(expect.arrayContaining(dramaLevel));
    expect(PAGE_METRICS.project.table).toEqual(["views", "avgViewedRate", "completionRate", "exitRate"]);
    expect(PAGE_METRICS.campaign.kpis).toEqual(["views", "avgViewedRate", "completionRate", "exitRate"]);
    expect(PAGE_METRICS.campaign.charts).toEqual(["views", "retention", "quartileReach"]);
  });

  it("definitions list only the metrics the page shows", () => {
    expect(pageDefinitions("projects")).toEqual(["impressions", "views", "viewRate", "avgViewedRate", "exitRate"]);
    expect(pageDefinitions("project")).toEqual([
      "impressions",
      "views",
      "viewRate",
      "avgViewedRate",
      "completionRate",
      "exitRate",
    ]);
    expect(pageDefinitions("campaign")).toEqual([
      "views",
      "avgViewedRate",
      "completionRate",
      "exitRate",
      "retention",
      "quartileReach",
    ]);
  });
});

describe("KST dates", () => {
  it("rolls over at 15:00 UTC", () => {
    expect(kstDate(new Date("2026-11-22T14:59:59Z"))).toBe("2026-11-22");
    expect(kstDate(new Date("2026-11-22T15:00:00Z"))).toBe("2026-11-23");
    expect(kstDateTime(new Date("2026-11-22T14:59:59Z"))).toBe("2026-11-22 23:59");
    expect(kstDateTime(new Date("2026-11-22T15:00:00Z"))).toBe("2026-11-23 00:00");
  });

  it("treats only a past PUBLISHED time as released", () => {
    const now = new Date("2026-11-23T03:00:00Z");
    expect(releaseDateOf("PUBLISHED", new Date("2026-11-22T15:00:00Z"), now)).toBe("2026-11-23");
    expect(releaseDateOf("PUBLISHED", now, now)).toBe("2026-11-23");
    expect(releaseDateOf("PUBLISHED", new Date("2026-11-23T03:00:01Z"), now)).toBeNull();
    expect(releaseDateOf("SCHEDULED", new Date("2026-11-01T00:00:00Z"), now)).toBeNull();
    expect(releaseDateOf("PUBLISHED", null, now)).toBeNull();
  });
});
