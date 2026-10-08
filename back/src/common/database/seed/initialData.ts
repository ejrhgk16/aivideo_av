import type { DeepPartial } from 'typeorm';

import type {
  Drama,
  DramaGenre,
  DramaImage,
  Episode,
  EpisodeSubtitle,
  EpisodeVideo,
  Genre,
  ProductionCompany,
} from '../../../content/entities/index.js';
import type {
  CollectionDrama,
  ContentCollection,
} from '../../../programming/entities/index.js';
import type { AdRewardOffer, PointProduct } from '../../../economy/entities/index.js';

export interface InitialSeedData {
  productionCompanies: Array<DeepPartial<ProductionCompany>>;
  genres: Array<DeepPartial<Genre>>;
  dramas: Array<DeepPartial<Drama>>;
  dramaGenres: Array<DeepPartial<DramaGenre>>;
  dramaImages: Array<DeepPartial<DramaImage>>;
  episodes: Array<DeepPartial<Episode>>;
  episodeVideos: Array<DeepPartial<EpisodeVideo>>;
  episodeSubtitles: Array<DeepPartial<EpisodeSubtitle>>;
  contentCollections: Array<DeepPartial<ContentCollection>>;
  collectionDramas: Array<DeepPartial<CollectionDrama>>;
  pointProducts: Array<DeepPartial<PointProduct>>;
  adRewardOffers: Array<DeepPartial<AdRewardOffer>>;
}

const fixedId = (namespace: number, sequence: number) =>
  `${String(namespace).padStart(8, '0')}-0000-4000-8000-${String(sequence).padStart(12, '0')}`;

const publishedAt = new Date('2025-01-01T00:00:00.000Z');

const productionCompanies = [
  { id: fixedId(1, 1), name: '라이트하우스 스튜디오', status: 'ACTIVE' },
  { id: fixedId(1, 2), name: '문라이트 픽처스', status: 'ACTIVE' },
  { id: fixedId(1, 3), name: '오로라 콘텐츠', status: 'ACTIVE' },
];

const genres = [
  { id: 1, code: 'ROMANCE', name: '로맨스', displayOrder: 1 },
  { id: 2, code: 'THRILLER', name: '스릴러', displayOrder: 2 },
  { id: 3, code: 'COMEDY', name: '코미디', displayOrder: 3 },
  { id: 4, code: 'FANTASY', name: '판타지', displayOrder: 4 },
  { id: 5, code: 'MYSTERY', name: '미스터리', displayOrder: 5 },
  { id: 6, code: 'DRAMA', name: '드라마', displayOrder: 6 },
];

const dramas = [
  {
    id: fixedId(2, 1),
    productionCompanyId: fixedId(1, 1),
    publicSlug: 'our-last-spring',
    title: '우리의 마지막 봄',
    shortDescription: '서로의 비밀을 간직한 두 사람의 봄날 로맨스',
    synopsis: '우연히 다시 만난 두 사람이 오래된 약속을 마주한다.',
    status: 'PUBLISHED',
    publishedAt,
  },
  {
    id: fixedId(2, 2),
    productionCompanyId: fixedId(1, 2),
    publicSlug: 'midnight-letter',
    title: '자정의 편지',
    shortDescription: '매일 자정 도착하는 발신인 없는 편지',
    synopsis: '편지의 수수께끼를 좇던 주인공은 자신의 과거를 발견한다.',
    status: 'PUBLISHED',
    publishedAt,
  },
  {
    id: fixedId(2, 3),
    productionCompanyId: fixedId(1, 3),
    publicSlug: 'second-take',
    title: '두 번째 테이크',
    shortDescription: '서툴지만 유쾌한 신인 배우들의 성장기',
    synopsis: '작은 촬영장에서 시작된 우정과 꿈이 무대 위에서 피어난다.',
    status: 'PUBLISHED',
    publishedAt,
  },
  {
    id: fixedId(2, 4),
    productionCompanyId: fixedId(1, 1),
    publicSlug: 'moonlit-garden',
    title: '달빛 정원',
    shortDescription: '달이 뜨면 열리는 비밀스러운 정원',
    synopsis: '평범한 정원사가 달빛 아래서만 보이는 세계를 만나게 된다.',
    status: 'PUBLISHED',
    publishedAt,
  },
  {
    id: fixedId(2, 5),
    productionCompanyId: fixedId(1, 2),
    publicSlug: 'the-quiet-room',
    title: '고요한 방',
    shortDescription: '아무도 말하지 않는 방에서 시작된 사건',
    synopsis: '한 호텔방의 침묵 속에 감춰진 진실을 찾아 나선다.',
    status: 'PUBLISHED',
    publishedAt,
  },
];

const dramaGenres = [
  { dramaId: dramas[0].id, genreId: 1 },
  { dramaId: dramas[0].id, genreId: 6 },
  { dramaId: dramas[1].id, genreId: 2 },
  { dramaId: dramas[1].id, genreId: 5 },
  { dramaId: dramas[2].id, genreId: 3 },
  { dramaId: dramas[2].id, genreId: 6 },
  { dramaId: dramas[3].id, genreId: 4 },
  { dramaId: dramas[3].id, genreId: 1 },
  { dramaId: dramas[4].id, genreId: 2 },
  { dramaId: dramas[4].id, genreId: 5 },
];

const dramaImages = dramas.flatMap((drama, dramaIndex) =>
  (['POSTER', 'HERO', 'THUMBNAIL'] as const).map((kind, kindIndex) => ({
    id: fixedId(3, dramaIndex * 10 + kindIndex + 1),
    dramaId: drama.id,
    kind,
    storageKey: `dramas/${drama.publicSlug}/images/${kind.toLowerCase()}.webp`,
    altText: `${drama.title} ${kind.toLowerCase()} 이미지`,
  })),
);

const episodes = dramas.flatMap((drama, dramaIndex) =>
  [1, 2, 3, 4].map((episodeNumber) => ({
    id: fixedId(4, dramaIndex * 10 + episodeNumber),
    dramaId: drama.id,
    episodeNumber,
    title: `${episodeNumber}화`,
    synopsis: `${drama.title} ${episodeNumber}화 이야기`,
    durationMs: 120000 + episodeNumber * 1000,
    pricePoints: episodeNumber === 1 ? 0 : episodeNumber * 10,
    status: 'PUBLISHED',
    publishedAt,
  })),
);

const episodeVideos = episodes.flatMap((episode) =>
  (['FULL', 'PREVIEW'] as const).map((kind, kindIndex) => ({
    id: fixedId(5, Number(episode.id.slice(-4)) * 10 + kindIndex + 1),
    episodeId: episode.id,
    kind,
    storageKey: `episodes/${episode.id}/${kind.toLowerCase()}.mp4`,
    thumbnailKey: `episodes/${episode.id}/thumbnail.webp`,
    durationMs: kind === 'FULL' ? episode.durationMs : 30000,
  })),
);

const episodeSubtitles = episodes.map((episode, index) => ({
  id: fixedId(6, index + 1),
  episodeId: episode.id,
  languageCode: 'ko',
  format: 'VTT',
  storageKey: `episodes/${episode.id}/subtitles/ko.vtt`,
}));

const contentCollections = [
  {
    id: fixedId(7, 1),
    code: 'HOME_FEATURED',
    title: '오늘의 추천',
    description: '지금 만나보세요',
    kind: 'HOME',
    isActive: true,
  },
  {
    id: fixedId(7, 2),
    code: 'EDITORIAL_TOP_3',
    title: '이번 주 TOP 3',
    description: '편집부가 고른 인기 작품',
    kind: 'EDITORIAL_RANKING',
    isActive: true,
  },
  {
    id: fixedId(7, 3),
    code: 'RECOMMENDATION_DAILY',
    title: '짧게 즐기는 추천',
    description: '새로운 이야기를 발견해 보세요',
    kind: 'RECOMMENDATION_FEED',
    isActive: true,
  },
];

const collectionDramas = [
  ...dramas.map((drama, index) => ({
    collectionId: contentCollections[0].id,
    dramaId: drama.id,
    displayOrder: index + 1,
    startsAt: null,
    endsAt: null,
  })),
  ...dramas.slice(0, 3).map((drama, index) => ({
    collectionId: contentCollections[1].id,
    dramaId: drama.id,
    displayOrder: index + 1,
    startsAt: null,
    endsAt: null,
  })),
  ...dramas.map((drama, index) => ({
    collectionId: contentCollections[2].id,
    dramaId: drama.id,
    displayOrder: index + 1,
    startsAt: null,
    endsAt: null,
  })),
];

const pointProducts = [
  { id: fixedId(8, 1), code: 'POINTS_100', points: 100, priceKrw: 1000, isActive: true },
  { id: fixedId(8, 2), code: 'POINTS_550', points: 550, priceKrw: 5000, isActive: true },
  { id: fixedId(8, 3), code: 'POINTS_1200', points: 1200, priceKrw: 10000, isActive: true },
];

const adRewardOffers = [
  { id: fixedId(9, 1), code: 'AD_REWARD_DEFAULT', rewardPoints: 20, dailyLimit: 5, isActive: true },
  { id: fixedId(9, 2), code: 'AD_REWARD_BONUS', rewardPoints: 50, dailyLimit: 2, isActive: true },
];

export const initialData: InitialSeedData = {
  productionCompanies,
  genres,
  dramas,
  dramaGenres,
  dramaImages,
  episodes,
  episodeVideos,
  episodeSubtitles,
  contentCollections,
  collectionDramas,
  pointProducts,
  adRewardOffers,
};

export default initialData;
