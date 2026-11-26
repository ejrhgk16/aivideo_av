import { describe, expect, it } from "vitest";
import { addDays, retentionArea, summarize } from "@/lib/metrics";
import { sampleCampaignStats, statsForCampaign, type SampleEpisode } from "@/lib/sampleMetrics";

const TODAY = "2026-11-23";
const UUID = "6f1c2b9e-4d3a-4f6e-9b1a-2c3d4e5f6a7b";
const episode = (overrides: Partial<SampleEpisode> = {}): SampleEpisode => ({
  uuid: UUID,
  episodeNumber: 1,
  durationSeconds: 90,
  releaseDate: "2026-01-01",
  ...overrides,
});
const uuids = Array.from({ length: 50 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);

describe("sampleCampaignStats", () => {
  it("is deterministic for the same uuid and day", () => {
    expect(sampleCampaignStats(episode(), TODAY)).toEqual(sampleCampaignStats(episode(), TODAY));
  });

  it("differs between uuids", () => {
    const a = sampleCampaignStats(episode({ uuid: uuids[0] }), TODAY);
    const b = sampleCampaignStats(episode({ uuid: uuids[1] }), TODAY);
    expect(a.retention).not.toEqual(b.retention);
    expect(a.daily).not.toEqual(b.daily);
  });

  it("has no data before release", () => {
    expect(sampleCampaignStats(episode({ releaseDate: null }), TODAY)).toEqual({
      releaseDate: null,
      durationSeconds: 90,
      retention: [],
      daily: [],
    });
    const tomorrow = addDays(TODAY, 1);
    expect(sampleCampaignStats(episode({ releaseDate: tomorrow }), TODAY)).toMatchObject({
      releaseDate: tomorrow,
      retention: [],
      daily: [],
    });
    expect(sampleCampaignStats(episode({ releaseDate: TODAY }), TODAY).daily.map(({ date }) => date)).toEqual([TODAY]);
  });

  it("covers at most 180 consecutive days ending today, from the release date when later", () => {
    const old = sampleCampaignStats(episode(), TODAY).daily.map(({ date }) => date);
    expect(old).toHaveLength(180);
    expect(old[0]).toBe(addDays(TODAY, -179));
    old.forEach((date, index) => expect(date).toBe(addDays(old[0], index)));

    const releaseDate = addDays(TODAY, -9);
    const recent = sampleCampaignStats(episode({ releaseDate }), TODAY).daily.map(({ date }) => date);
    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe(releaseDate);
    expect(recent.at(-1)).toBe(TODAY);
  });

  it("keeps a past date's numbers when today moves forward", () => {
    const before = sampleCampaignStats(episode(), TODAY);
    const after = sampleCampaignStats(episode(), addDays(TODAY, 1));
    expect(after.retention).toEqual(before.retention);
    expect(after.daily.slice(0, -1)).toEqual(before.daily.slice(1));
  });

  it("has a 21-point retention curve from 1 that never rises or drops below 0.05", () => {
    for (const uuid of uuids) {
      const { retention } = sampleCampaignStats(episode({ uuid }), TODAY);
      expect(retention).toHaveLength(21);
      expect(retention[0]).toBe(1);
      retention.slice(1).forEach((value, index) => {
        expect(value).toBeLessThanOrEqual(retention[index]);
        expect(value).toBeGreaterThanOrEqual(0.05);
      });
    }
  });

  it("keeps daily rows consistent with the curve", () => {
    for (const uuid of uuids) {
      const stats = sampleCampaignStats(episode({ uuid }), TODAY);
      for (const row of stats.daily) {
        expect(row.views).toBeLessThanOrEqual(row.impressions);
        expect(row.completions).toBeLessThanOrEqual(row.views);
      }
      const lifetime = summarize([stats], { start: "2000-01-01", end: TODAY });
      expect(Math.abs(lifetime.completionRate! - stats.retention[18])).toBeLessThan(0.01);
      expect(Math.abs(lifetime.avgViewedRate! - retentionArea(stats.retention))).toBeLessThan(0.01);
    }
  });
});

describe("statsForCampaign", () => {
  // 2026-11-23 00:00 KST
  const now = new Date("2026-11-22T15:00:00Z");
  const campaign = {
    uuid: UUID,
    episodeNumber: 2,
    durationMs: 61_499,
    status: "PUBLISHED" as const,
    publishedAt: new Date("2026-11-01T03:00:00Z"),
  };

  it("uses the KST release date, rounded seconds and the KST date of now", () => {
    expect(statsForCampaign(campaign, now)).toEqual(
      sampleCampaignStats({ uuid: UUID, episodeNumber: 2, durationSeconds: 61, releaseDate: "2026-11-01" }, TODAY),
    );
    expect(statsForCampaign({ ...campaign, publishedAt: now }, now).daily.map(({ date }) => date)).toEqual([TODAY]);
  });

  it("rounds the duration to whole seconds, at least 1", () => {
    expect(statsForCampaign({ ...campaign, durationMs: 1_500 }, now).durationSeconds).toBe(2);
    expect(statsForCampaign({ ...campaign, durationMs: 400 }, now).durationSeconds).toBe(1);
    expect(statsForCampaign({ ...campaign, durationMs: 0 }, now).durationSeconds).toBe(1);
  });

  it("has no data unless released", () => {
    const empty = { releaseDate: null, retention: [], daily: [] };
    expect(statsForCampaign({ ...campaign, status: "SCHEDULED" }, now)).toMatchObject(empty);
    expect(statsForCampaign({ ...campaign, publishedAt: new Date("2026-11-22T15:00:01Z") }, now)).toMatchObject(empty);
    expect(statsForCampaign({ ...campaign, publishedAt: null }, now)).toMatchObject(empty);
  });
});
