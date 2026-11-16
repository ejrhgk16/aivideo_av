import {
  addDays, retentionArea,
  type AdminCampaign, type AdminDailyStat, type AdminProject, type AdminProjectStatus,
} from './adminMetrics';

/** Fixed "today" (KST) of the sample data set. The earliest release gives 180 days of history. */
export const ADMIN_SAMPLE_TODAY = '2026-11-05';

// mulberry32: deterministic sample values without Math.random.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const random = seeded(20261105);

const projectSeeds: {
  id: string; title: string; genre: string; status: AdminProjectStatus; description: string;
  firstRelease: number; interval: number; peakImpressions: number; titles: string[];
}[] = [
  {
    id: 'last-signal', title: '마지막 신호', genre: '스릴러', status: 'LIVE', firstRelease: -160, interval: 12, peakImpressions: 9000,
    description: '끊긴 무전 너머의 목소리를 쫓는 구조대원의 72시간.',
    titles: ['정적', '두 번째 주파수', '구조 요청', '지워진 기록', '폐쇄 구역', '거짓 좌표', '배신자', '역추적', '마지막 교신', '붕괴', '생존자', '신호의 끝'],
  },
  {
    id: 'spring-contract', title: '봄밤의 계약', genre: '로맨스', status: 'LIVE', firstRelease: -110, interval: 12, peakImpressions: 12000,
    description: '1년짜리 계약 연애가 끝나기 30일 전, 둘의 계산이 어긋나기 시작한다.',
    titles: ['계약서', '첫 데이트 규칙', '들킨 거짓말', '비 오는 정류장', '조항 7', '질투', '연장 협상', '고백 금지', '파기', '봄밤'],
  },
  {
    id: 'black-garden', title: '검은 정원', genre: '미스터리', status: 'COMPLETED', firstRelease: -179, interval: 5, peakImpressions: 5000,
    description: '저택 정원에서만 피는 검은 꽃과 사라진 상속인.',
    titles: ['상속인', '검은 꽃', '정원사의 일기', '잠긴 온실', '두 개의 유언', '뿌리', '밤의 손님', '마지막 개화'],
  },
  {
    id: 'seoul-2099', title: '서울 2099', genre: 'SF', status: 'SCHEDULED', firstRelease: 10, interval: 7, peakImpressions: 0,
    description: '기억을 사고파는 도시에서 자신의 기억을 되찾으려는 배달원.',
    titles: ['기억 배달', '암시장', '복제된 하루', '삭제 요청', '원본', '재부팅'],
  },
];

function makeRetention() {
  const spike = 6 + Math.floor(random() * 8);
  const points = [1];
  for (let index = 1; index <= 20; index += 1) {
    const drop = (index === 1 ? 0.06 : 0.018) + random() * 0.015 + (index === spike ? 0.06 + random() * 0.04 : 0);
    points.push(Math.max(0.05, Math.round((points[index - 1] - drop) * 1000) / 1000));
  }
  return points;
}

function makeCampaign(seed: typeof projectSeeds[number], title: string, index: number): AdminCampaign {
  const releaseDate = addDays(ADMIN_SAMPLE_TODAY, seed.firstRelease + index * seed.interval);
  const durationSeconds = 60 + Math.floor(random() * 50);
  const released = releaseDate <= ADMIN_SAMPLE_TODAY;
  const retention = released ? makeRetention() : [];
  const completionRate = retention[18] ?? 0;
  const avgViewedRate = retentionArea(retention);
  const peak = seed.peakImpressions * (1 - index * 0.05);
  const viewRate = 0.25 + random() * 0.2;
  const daily: AdminDailyStat[] = [];
  for (let date = releaseDate, age = 0; date <= ADMIN_SAMPLE_TODAY; date = addDays(date, 1), age += 1) {
    const impressions = Math.round(peak * (0.15 + 0.85 * Math.exp(-age / 21)) * (0.85 + random() * 0.3));
    const views = Math.round(impressions * viewRate * (0.9 + random() * 0.2));
    // Small daily wobble so period deltas move; lifetime figures stay within ~1%p of the curve.
    const depth = 0.97 + random() * 0.06;
    daily.push({
      date, impressions, views,
      completions: Math.round(views * completionRate * depth),
      watchSeconds: Math.round(views * durationSeconds * avgViewedRate * depth),
    });
  }
  return {
    id: `${seed.id}-${String(index + 1).padStart(2, '0')}`, episodeNumber: index + 1, title,
    releaseDate, durationSeconds, pricePoints: index < 3 ? 0 : 10, retention, daily,
  };
}

export const ADMIN_SAMPLE_PROJECTS: AdminProject[] = projectSeeds.map((seed) => ({
  id: seed.id, title: seed.title, description: seed.description, genre: seed.genre, status: seed.status,
  campaigns: seed.titles.map((title, index) => makeCampaign(seed, title, index)),
}));

export const findAdminProject = (id?: string) => ADMIN_SAMPLE_PROJECTS.find((project) => project.id === id) ?? null;

export function findAdminCampaign(id?: string) {
  for (const project of ADMIN_SAMPLE_PROJECTS) {
    const campaign = project.campaigns.find((item) => item.id === id);
    if (campaign) return { project, campaign };
  }
  return null;
}
