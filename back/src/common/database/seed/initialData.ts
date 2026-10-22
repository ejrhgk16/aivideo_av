import type { DeepPartial } from 'typeorm';

import {
  createDramaImageStorageKey,
  createDramaPreviewStorageKey,
  createEpisodeImageStorageKey,
  createEpisodeSubtitleStorageKey,
  createEpisodeVideoStorageKey,
  createGenreImageStorageKey,
} from '../../../content/mediaStorage.js';
import type {
  ContentImage,
  ContentVideo,
  Drama,
  DramaGenre,
  Episode,
  EpisodeSubtitle,
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
  contentImages: Array<DeepPartial<ContentImage>>;
  episodes: Array<DeepPartial<Episode>>;
  contentVideos: Array<DeepPartial<ContentVideo>>;
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

const contentImages = [
  ...dramas.flatMap((drama, dramaIndex) => [
    ...(['POSTER', 'HOME_HERO', 'DETAIL_COVER'] as const).map((kind, kindIndex) => {
      const id = fixedId(3, dramaIndex * 10 + kindIndex + 1);

      return {
        id,
        contentType: 'DRAMA',
        contentId: drama.id,
        kind,
        storageKey: createDramaImageStorageKey(drama.id, id, kind),
        altText: `${drama.title} ${kind.toLowerCase()} 이미지`,
        displayOrder: 1,
      };
    }),
    ...[1, 2].map((displayOrder) => {
      const id = fixedId(3, dramaIndex * 10 + 4 + displayOrder);

      return {
        id,
        contentType: 'DRAMA',
        contentId: drama.id,
        kind: 'CAMPAIGN',
        storageKey: createDramaImageStorageKey(drama.id, id, 'CAMPAIGN'),
        altText: `${drama.title} 캠페인 이미지 ${displayOrder}`,
        displayOrder,
      };
    }),
  ]),
  ...genres.map((genre, genreIndex) => {
    const id = fixedId(3, 51 + genreIndex);

    return {
      id,
      contentType: 'GENRE',
      contentId: String(genre.id),
      kind: 'GENRE_TILE',
      storageKey: createGenreImageStorageKey(genre.id, id),
      altText: `${genre.name} 장르 이미지`,
      displayOrder: 1,
    };
  }),
];

const landscapePosters = dramas.map((drama, dramaIndex) => {
  const id = fixedId(3, dramaIndex * 10 + 7);

  return {
    id,
    contentType: 'DRAMA',
    contentId: drama.id,
    kind: 'POSTER_LANDSCAPE',
    storageKey: createDramaImageStorageKey(drama.id, id, 'POSTER_LANDSCAPE'),
    altText: `${drama.title} 가로 포스터 이미지`,
    displayOrder: 1,
  };
});

const episodeDurationsMs = [103125, 53453, 84084, 92459, 68610, 92593, 52500];

const episodes = dramas.flatMap((drama, dramaIndex) =>
  [1, 2, 3, 4].map((episodeNumber) => ({
    id: fixedId(4, dramaIndex * 10 + episodeNumber),
    dramaId: drama.id,
    episodeNumber,
    title: `${episodeNumber}화`,
    synopsis: `${drama.title} ${episodeNumber}화 이야기`,
    durationMs: episodeDurationsMs[(dramaIndex * 4 + episodeNumber - 1) % episodeDurationsMs.length],
    pricePoints: episodeNumber === 1 ? 0 : episodeNumber * 10,
    status: 'PUBLISHED',
    publishedAt,
  })),
);

const contentImagesForEpisodes = episodes.map((episode, episodeIndex) => {
  const id = fixedId(3, 61 + episodeIndex);

  return {
    id,
    contentType: 'EPISODE',
    contentId: episode.id,
    kind: 'EPISODE_COVER',
    storageKey: createEpisodeImageStorageKey(episode.dramaId, episode.id, id),
    altText: `${episode.title} 커버 이미지`,
    displayOrder: 1,
  };
});

const contentVideos = [
  ...dramas.flatMap((drama, dramaIndex) =>
    [1, 2].map((displayOrder) => {
      const id = fixedId(5, dramaIndex * 10 + displayOrder);

      return {
        id,
        contentType: 'DRAMA',
        contentId: drama.id,
        kind: 'PREVIEW',
        storageKey: createDramaPreviewStorageKey(drama.id, id),
        durationMs: 15000,
        displayOrder,
      };
    }),
  ),
  ...episodes.map((episode, episodeIndex) => {
    const id = fixedId(5, 51 + episodeIndex);

    return {
      id,
      contentType: 'EPISODE',
      contentId: episode.id,
      kind: 'FULL',
      storageKey: createEpisodeVideoStorageKey(episode.dramaId, episode.id, id),
      durationMs: episode.durationMs,
      displayOrder: 1,
    };
  }),
];

const episodeSubtitles = episodes.map((episode, index) => {
  const languageCode = 'ko';
  const format = 'VTT';

  return {
    id: fixedId(6, index + 1),
    episodeId: episode.id,
    languageCode,
    format,
    storageKey: createEpisodeSubtitleStorageKey(
      episode.dramaId,
      episode.id,
      languageCode,
      format,
    ),
  };
});

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
  {
    id: fixedId(7, 4),
    code: 'HOME_CAMPAIGN',
    title: '로맨스 만나기',
    description: '퇴근길을 채울 로맨스 한 편',
    kind: 'HOME',
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
  {
    collectionId: contentCollections[3].id,
    dramaId: dramas[0].id,
    displayOrder: 1,
    startsAt: null,
    endsAt: null,
  },
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
  contentImages: [...contentImages, ...landscapePosters, ...contentImagesForEpisodes],
  episodes,
  contentVideos,
  episodeSubtitles,
  contentCollections,
  collectionDramas,
  pointProducts,
  adRewardOffers,
};

export default initialData;
