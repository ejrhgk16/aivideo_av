import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';

import {
  DramaGenre,
  Episode,
  aiDramaEntities,
} from '../../../src/common/database/entities.js';

const expectedTableNames = new Set([
  'users',
  'user_preferences',
  'production_companies',
  'dramas',
  'genres',
  'drama_genres',
  'drama_images',
  'episodes',
  'episode_videos',
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

    expect(tableNames).toHaveLength(22);
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
