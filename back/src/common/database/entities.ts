export * from '../../identity/entities/index.js';
export * from '../../content/entities/index.js';
export * from '../../programming/entities/index.js';
export * from '../../playback/entities/index.js';
export * from '../../economy/entities/index.js';

import {
  AuthSession,
  RefreshToken,
  User,
  UserPreference,
} from '../../identity/entities/index.js';
import {
  Drama,
  DramaGenre,
  ContentImage,
  ContentVideo,
  Episode,
  EpisodeSubtitle,
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
  AuthSession,
  RefreshToken,
  ProductionCompany,
  Drama,
  Genre,
  DramaGenre,
  ContentImage,
  Episode,
  ContentVideo,
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
