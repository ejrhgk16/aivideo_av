import {
  addDays,
  kstDate,
  releaseDateOf,
  retentionArea,
  type CampaignStats,
  type ContentStatus,
  type DailyStat,
} from "@/lib/metrics";

/**
 * Sample statistics for real episodes until impression and playback events are collected.
 * Values are deterministic per episode UUID and date, so a reload or a later day shows the same history.
 */

/** The longest range (90 days) plus its comparison period. */
const HISTORY_DAYS = 180;

// mulberry32
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a
function hash(text: string) {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function makeRetention(random: () => number) {
  const spike = 6 + Math.floor(random() * 8);
  const points = [1];
  for (let index = 1; index <= 20; index += 1) {
    const drop = (index === 1 ? 0.06 : 0.018) + random() * 0.015 + (index === spike ? 0.06 + random() * 0.04 : 0);
    points.push(Math.max(0.05, Math.round((points[index - 1] - drop) * 1000) / 1000));
  }
  return points;
}

export type SampleEpisode = {
  uuid: string;
  episodeNumber: number;
  durationSeconds: number;
  /** KST date the episode became public, or null if it is not public yet. */
  releaseDate: string | null;
};

/** today is the KST date (YYYY-MM-DD) the figures run up to. */
export function sampleCampaignStats(episode: SampleEpisode, today: string): CampaignStats {
  const { releaseDate, durationSeconds } = episode;
  if (releaseDate === null || releaseDate > today) return { releaseDate, durationSeconds, retention: [], daily: [] };

  const random = seeded(hash(episode.uuid));
  const retention = makeRetention(random);
  const completionRate = retention[18];
  const avgViewedRate = retentionArea(retention);
  const peak = (4000 + random() * 8000) * Math.max(0.3, 1 - (episode.episodeNumber - 1) * 0.05);
  const viewRate = 0.25 + random() * 0.2;
  const first = addDays(today, 1 - HISTORY_DAYS);
  const daily: DailyStat[] = [];
  let age = Math.max(0, Math.round((Date.parse(first) - Date.parse(releaseDate)) / 86_400_000));
  for (let date = releaseDate > first ? releaseDate : first; date <= today; date = addDays(date, 1), age += 1) {
    const day = seeded(hash(`${episode.uuid}:${date}`));
    const impressions = Math.round(peak * (0.15 + 0.85 * Math.exp(-age / 21)) * (0.85 + day() * 0.3));
    const views = Math.round(impressions * viewRate * (0.9 + day() * 0.2));
    // Small daily wobble so period deltas move; lifetime figures stay within ~1%p of the curve.
    const depth = 0.97 + day() * 0.06;
    daily.push({
      date,
      impressions,
      views,
      completions: Math.round(views * completionRate * depth),
      watchSeconds: Math.round(views * durationSeconds * avgViewedRate * depth),
    });
  }
  return { releaseDate, durationSeconds, retention, daily };
}

/** Sample statistics for a campaign row from the catalog, up to now's KST date. */
export function statsForCampaign(
  campaign: { uuid: string; episodeNumber: number; durationMs: number; status: ContentStatus; publishedAt: Date | null },
  now: Date,
): CampaignStats {
  return sampleCampaignStats(
    {
      uuid: campaign.uuid,
      episodeNumber: campaign.episodeNumber,
      durationSeconds: Math.max(1, Math.round(campaign.durationMs / 1000)),
      releaseDate: releaseDateOf(campaign.status, campaign.publishedAt, now),
    },
    kstDate(now),
  );
}
