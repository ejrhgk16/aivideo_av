export * from '../../identity/entities/index.js';
export * from '../../content/entities/index.js';
export * from '../../programming/entities/index.js';
export * from '../../playback/entities/index.js';
export * from '../../economy/entities/index.js';

import {
  User,
  UserPreference,
} from '../../identity/entities/index.js';
import {
  Drama,
  DramaGenre,
  DramaImage,
  Episode,
  EpisodeSubtitle,
  EpisodeVideo,
  Genre,
  ProductionCompany,
} from '../../content/entities/index.js';
import {
  CollectionDrama,
  ContentCollection,
} from '../../programming/entities/index.js';
import {
  UserPreviewFeedState,
  UserSavedDrama,
  UserWatchProgress,
} from '../../playback/entities/index.js';
import {
  AdRewardClaim,
  AdRewardOffer,
  EpisodeEntitlement,
  PointProduct,
  PointPurchaseOrder,
  PointTransaction,
  Wallet,
} from '../../economy/entities/index.js';

export const aiDramaEntities = [
  User,
  UserPreference,
  ProductionCompany,
  Drama,
  Genre,
  DramaGenre,
  DramaImage,
  Episode,
  EpisodeVideo,
  EpisodeSubtitle,
  ContentCollection,
  CollectionDrama,
  UserPreviewFeedState,
  UserSavedDrama,
  UserWatchProgress,
  AdRewardClaim,
  AdRewardOffer,
  EpisodeEntitlement,
  PointProduct,
  PointPurchaseOrder,
  PointTransaction,
  Wallet,
];
