import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';

import {
  AdRewardClaim,
  AdRewardOffer,
  AuthSession,
  ContentCollection,
  ContentImage,
  ContentVideo,
  DramaGenre,
  Episode,
  EpisodeEntitlement,
  EpisodeSubtitle,
  PointProduct,
  PointPurchaseOrder,
  PointTransaction,
  ProductionCompany,
  RefreshToken,
  Drama,
  User,
  UserPreference,
  CollectionDrama,
  UserPreviewFeedState,
  UserSavedDrama,
  UserWatchProgress,
  Wallet,
  aiDramaEntities,
} from '../../../src/common/database/entities.js';

const expectedTableNames = new Set([
  'users',
  'user_preferences',
  'auth_sessions',
  'refresh_tokens',
  'production_companies',
  'dramas',
  'genres',
  'drama_genres',
  'content_images',
  'episodes',
  'content_videos',
  'episode_subtitles',
  'content_collections',
  'collection_dramas',
  'user_preview_feed_states',
  'user_saved_dramas',
  'user_watch_progress',
  'ad_reward_claims',
  'ad_reward_offers',
  'episode_entitlements',
  'point_products',
  'point_purchase_orders',
  'point_transactions',
  'wallets',
]);

const metadataStorage = getMetadataArgsStorage();
const uuidEntities = [
  User,
  ProductionCompany,
  Drama,
  ContentImage,
  ContentVideo,
  Episode,
  EpisodeSubtitle,
  ContentCollection,
  PointTransaction,
  EpisodeEntitlement,
  PointProduct,
  PointPurchaseOrder,
  AdRewardOffer,
  AdRewardClaim,
];

describe('AI DRAMA entity registry', () => {
  it('registers exactly the documented table set once', () => {
    const tableNames = aiDramaEntities.map((entity) => {
      const table = metadataStorage.tables.find(({ target }) => target === entity);

      expect(table).toBeDefined();
      if (!table?.name) {
        throw new Error(`Missing table metadata for ${entity.name}`);
      }

      return table.name;
    });

    expect(tableNames).toHaveLength(24);
    expect(new Set(tableNames).size).toBe(tableNames.length);
    expect(new Set(tableNames)).toEqual(expectedTableNames);
  });

  it('preserves representative key and constraint metadata', () => {
    const primaryColumns = metadataStorage.columns
      .filter(({ target, options }) => target === DramaGenre && options.primary)
      .map(({ propertyName, options }) => options.name ?? propertyName);

    expect(new Set(primaryColumns)).toEqual(new Set(['drama_id', 'genre_id']));
    expect(metadataStorage.uniques).toContainEqual(
      expect.objectContaining({
        target: Episode,
        name: 'uq_episodes_drama_id_episode_number',
        columns: ['dramaId', 'episodeNumber'],
      }),
    );
    expect(metadataStorage.checks).toContainEqual(
      expect.objectContaining({
        target: Episode,
        expression: 'episode_number > 0',
      }),
    );
    expect(metadataStorage.indices).toContainEqual(
      expect.objectContaining({
        target: Episode,
        name: 'idx_episodes_status_published_at',
        columns: ['status', 'publishedAt'],
      }),
    );
    expect(metadataStorage.uniques).toContainEqual(
      expect.objectContaining({
        target: ContentImage,
        name: 'uq_content_images_content_type_content_id_kind_display_order',
        columns: ['contentType', 'contentId', 'kind', 'displayOrder'],
      }),
    );
    expect(metadataStorage.checks).toContainEqual(
      expect.objectContaining({
        target: ContentVideo,
        expression: 'display_order > 0',
      }),
    );
  });

  it('uses unsigned generated primary keys and unique UUID columns', () => {
    for (const entity of uuidEntities) {
      expect(metadataStorage.columns).toContainEqual(
        expect.objectContaining({
          target: entity,
          propertyName: 'id',
          options: expect.objectContaining({
            primary: true,
            type: 'int',
            unsigned: true,
          }),
        }),
      );
      expect(metadataStorage.generations).toContainEqual(
        expect.objectContaining({ target: entity, propertyName: 'id', strategy: 'increment' }),
      );
      expect(metadataStorage.columns).toContainEqual(
        expect.objectContaining({
          target: entity,
          propertyName: 'uuid',
          options: expect.objectContaining({
            type: 'char',
            length: 36,
            unique: true,
          }),
        }),
      );
    }
  });

  it('keeps login credentials nullable and excludes the password by default', () => {
    expect(metadataStorage.columns).toContainEqual(
      expect.objectContaining({
        target: User,
        propertyName: 'loginId',
        options: expect.objectContaining({ name: 'login_id', type: 'varchar', length: 100, nullable: true }),
      }),
    );
    expect(metadataStorage.columns).toContainEqual(
      expect.objectContaining({
        target: User,
        propertyName: 'password',
        options: expect.objectContaining({ type: 'varchar', length: 255, nullable: true, select: false }),
      }),
    );
    expect(metadataStorage.indices).toContainEqual(
      expect.objectContaining({
        target: User,
        name: 'uq_users_login_id',
        columns: ['loginId'],
        unique: true,
      }),
    );
  });

  it('uses unsigned integer columns for migrated parent references', () => {
    const references = [
      [AuthSession, 'userId'],
      [RefreshToken, 'authSessionId'],
      [User, 'productionCompanyId'],
      [UserPreference, 'userId'],
      [Drama, 'productionCompanyId'],
      [DramaGenre, 'dramaId'],
      [ContentImage, 'contentId'],
      [ContentVideo, 'contentId'],
      [Episode, 'dramaId'],
      [EpisodeSubtitle, 'episodeId'],
      [CollectionDrama, 'collectionId'],
      [CollectionDrama, 'dramaId'],
      [UserPreviewFeedState, 'userId'],
      [UserPreviewFeedState, 'collectionId'],
      [UserPreviewFeedState, 'dramaId'],
      [UserSavedDrama, 'userId'],
      [UserSavedDrama, 'dramaId'],
      [UserWatchProgress, 'userId'],
      [UserWatchProgress, 'episodeId'],
      [Wallet, 'userId'],
      [PointTransaction, 'walletUserId'],
      [EpisodeEntitlement, 'userId'],
      [EpisodeEntitlement, 'episodeId'],
      [EpisodeEntitlement, 'unlockTransactionId'],
      [PointPurchaseOrder, 'userId'],
      [PointPurchaseOrder, 'pointProductId'],
      [PointPurchaseOrder, 'awardTransactionId'],
      [AdRewardClaim, 'userId'],
      [AdRewardClaim, 'adRewardOfferId'],
      [AdRewardClaim, 'rewardTransactionId'],
    ] as const;

    for (const [target, propertyName] of references) {
      expect(metadataStorage.columns).toContainEqual(
        expect.objectContaining({
          target,
          propertyName,
          options: expect.objectContaining({ type: 'int', unsigned: true }),
        }),
      );
    }
  });

  it('defines auth session and refresh token storage metadata', () => {
    for (const entity of [AuthSession, RefreshToken]) {
      expect(metadataStorage.columns).toContainEqual(
        expect.objectContaining({
          target: entity,
          propertyName: 'id',
          options: expect.objectContaining({ primary: true, type: 'int', unsigned: true }),
        }),
      );
      expect(metadataStorage.generations).toContainEqual(
        expect.objectContaining({ target: entity, propertyName: 'id', strategy: 'increment' }),
      );
    }
    expect(metadataStorage.columns).toContainEqual(
      expect.objectContaining({
        target: AuthSession,
        propertyName: 'revokedAt',
        options: expect.objectContaining({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }),
      }),
    );
    expect(metadataStorage.columns).toContainEqual(
      expect.objectContaining({
        target: RefreshToken,
        propertyName: 'tokenHash',
        options: expect.objectContaining({ name: 'token_hash', type: 'char', length: 64, unique: true }),
      }),
    );
    expect(metadataStorage.columns).toContainEqual(
      expect.objectContaining({
        target: RefreshToken,
        propertyName: 'usedAt',
        options: expect.objectContaining({ name: 'used_at', type: 'datetime', precision: 3, nullable: true }),
      }),
    );
    expect(metadataStorage.indices).toContainEqual(
      expect.objectContaining({ target: AuthSession, name: 'idx_auth_sessions_user_id', columns: ['userId'] }),
    );
    expect(metadataStorage.indices).toContainEqual(
      expect.objectContaining({ target: RefreshToken, name: 'idx_refresh_tokens_auth_session_id', columns: ['authSessionId'] }),
    );
    expect(metadataStorage.indices).toContainEqual(
      expect.objectContaining({ target: RefreshToken, name: 'idx_refresh_tokens_expires_at', columns: ['expiresAt'] }),
    );
  });

  it('does not register object relations for the documented entities', () => {
    const registeredEntities = new Set<Function>(aiDramaEntities);
    const relations = metadataStorage.relations.filter(
      ({ target }) =>
        typeof target === 'function' && registeredEntities.has(target),
    );

    expect(relations).toHaveLength(0);
  });
});
