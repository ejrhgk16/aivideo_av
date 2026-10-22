import type { MigrationInterface, QueryRunner } from 'typeorm';

const uuidTables = [
  'users',
  'production_companies',
  'dramas',
  'content_images',
  'content_videos',
  'episodes',
  'episode_subtitles',
  'content_collections',
  'point_transactions',
  'episode_entitlements',
  'point_products',
  'point_purchase_orders',
  'ad_reward_offers',
  'ad_reward_claims',
] as const;

const references = [
  ['users', 'production_company_id', 'production_companies', true],
  ['user_preferences', 'user_id', 'users', false],
  ['dramas', 'production_company_id', 'production_companies', false],
  ['drama_genres', 'drama_id', 'dramas', false],
  ['episodes', 'drama_id', 'dramas', false],
  ['episode_subtitles', 'episode_id', 'episodes', false],
  ['collection_dramas', 'collection_id', 'content_collections', false],
  ['collection_dramas', 'drama_id', 'dramas', false],
  ['user_saved_dramas', 'user_id', 'users', false],
  ['user_saved_dramas', 'drama_id', 'dramas', false],
  ['user_watch_progress', 'user_id', 'users', false],
  ['user_watch_progress', 'episode_id', 'episodes', false],
  ['user_preview_feed_states', 'user_id', 'users', false],
  ['user_preview_feed_states', 'collection_id', 'content_collections', false],
  ['user_preview_feed_states', 'drama_id', 'dramas', false],
  ['wallets', 'user_id', 'users', false],
  ['point_transactions', 'wallet_user_id', 'users', false],
  ['episode_entitlements', 'user_id', 'users', false],
  ['episode_entitlements', 'episode_id', 'episodes', false],
  ['episode_entitlements', 'unlock_transaction_id', 'point_transactions', true],
  ['point_purchase_orders', 'user_id', 'users', false],
  ['point_purchase_orders', 'point_product_id', 'point_products', false],
  ['point_purchase_orders', 'award_transaction_id', 'point_transactions', true],
  ['ad_reward_claims', 'user_id', 'users', false],
  ['ad_reward_claims', 'ad_reward_offer_id', 'ad_reward_offers', false],
  ['ad_reward_claims', 'reward_transaction_id', 'point_transactions', true],
] as const;

const quote = (identifier: string) => `\`${identifier}\``;

async function assertNoRows(
  queryRunner: QueryRunner,
  sql: string,
  message: string,
): Promise<void> {
  const [{ count }] = (await queryRunner.query(sql)) as { count: number }[];
  if (Number(count) !== 0) {
    throw new Error(`${message}: ${count} row(s)`);
  }
}

export class UseNumericPrimaryKeys20261022000000
  implements MigrationInterface
{
  name = 'UseNumericPrimaryKeys20261022000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // MySQL DDL implicitly commits. Before applying, take a mysqldump
    // (--single-transaction), restore it into an isolated MySQL 8.4 schema,
    // verify the migration chain and row counts, then rehearse up/down/reapply.
    for (const table of uuidTables) {
      await queryRunner.query(
        `ALTER TABLE ${quote(table)} ADD COLUMN uuid CHAR(36) NULL AFTER id`,
      );
      await queryRunner.query(
        `UPDATE ${quote(table)} SET uuid = id`,
      );
      const [{ count }] = (await queryRunner.query(
        `SELECT COUNT(*) AS count FROM ${quote(table)}`,
      )) as { count: number }[];
      if (Number(count) > 4_294_967_295) {
        throw new Error(`${table} exceeds the INT UNSIGNED key range`);
      }
      await assertNoRows(
        queryRunner,
        `SELECT COUNT(*) AS count FROM ${quote(table)} WHERE uuid IS NULL OR uuid = ''`,
        `Invalid preserved ${table}.uuid value`,
      );
      await queryRunner.query(
        `ALTER TABLE ${quote(table)} MODIFY uuid CHAR(36) NOT NULL, DROP PRIMARY KEY, DROP COLUMN id, ADD COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST, ADD UNIQUE KEY ${quote(`uq_${table}_uuid`)} (uuid)`,
      );
    }

    for (const [table, column, parent, nullable] of references) {
      const nullCondition = nullable ? ` AND child.${quote(column)} IS NOT NULL` : '';
      await assertNoRows(
        queryRunner,
        `SELECT COUNT(*) AS count FROM ${quote(table)} child LEFT JOIN ${quote(parent)} parent ON child.${quote(column)} = parent.uuid WHERE parent.id IS NULL${nullCondition}`,
        `Unmapped ${table}.${column} UUID reference`,
      );
    }

    for (const table of ['content_images', 'content_videos']) {
      await assertNoRows(
        queryRunner,
        `SELECT COUNT(*) AS count FROM ${quote(table)} WHERE (content_type = 'DRAMA' AND content_id NOT IN (SELECT uuid FROM dramas)) OR (content_type = 'EPISODE' AND content_id NOT IN (SELECT uuid FROM episodes)) OR (content_type = 'GENRE' AND (content_id NOT REGEXP '^[0-9]+$' OR CAST(content_id AS UNSIGNED) NOT IN (SELECT id FROM genres)))`,
        `Unmapped ${table}.content_id reference`,
      );
      await assertNoRows(
        queryRunner,
        `SELECT COUNT(*) AS count FROM (SELECT CAST(content_id AS UNSIGNED) AS genre_id, kind, display_order FROM ${quote(table)} WHERE content_type = 'GENRE' GROUP BY CAST(content_id AS UNSIGNED), kind, display_order HAVING COUNT(*) > 1) duplicates`,
        `Duplicate mapped ${table} GENRE reference`,
      );
    }

    for (const [table, column, parent] of references) {
      await queryRunner.query(
        `UPDATE ${quote(table)} child JOIN ${quote(parent)} parent ON child.${quote(column)} = parent.uuid SET child.${quote(column)} = parent.id`,
      );
    }

    for (const table of ['content_images', 'content_videos']) {
      await queryRunner.query(
        `UPDATE ${quote(table)} child JOIN dramas parent ON child.content_type = 'DRAMA' AND child.content_id = parent.uuid SET child.content_id = parent.id`,
      );
      await queryRunner.query(
        `UPDATE ${quote(table)} child JOIN episodes parent ON child.content_type = 'EPISODE' AND child.content_id = parent.uuid SET child.content_id = parent.id`,
      );
    }

    const modifiedReferences = new Set(
      references.map(([table, column]) => `${table}.${column}`),
    );
    for (const qualified of modifiedReferences) {
      const [table, column] = qualified.split('.');
      const nullable = references.find(
        ([refTable, refColumn]) => refTable === table && refColumn === column,
      )?.[3];
      await queryRunner.query(
        `ALTER TABLE ${quote(table)} MODIFY ${quote(column)} INT UNSIGNED ${nullable ? 'NULL' : 'NOT NULL'}`,
      );
    }

    for (const table of ['content_images', 'content_videos']) {
      await queryRunner.query(
        `ALTER TABLE ${quote(table)} MODIFY content_id INT UNSIGNED NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column, parent, nullable] of references) {
      const nullCondition = nullable ? ` AND child.${quote(column)} IS NOT NULL` : '';
      await assertNoRows(
        queryRunner,
        `SELECT COUNT(*) AS count FROM ${quote(table)} child LEFT JOIN ${quote(parent)} parent ON child.${quote(column)} = parent.id WHERE parent.uuid IS NULL${nullCondition}`,
        `Unmapped ${table}.${column} integer reference`,
      );
    }

    for (const table of ['content_images', 'content_videos']) {
      await assertNoRows(
        queryRunner,
        `SELECT COUNT(*) AS count FROM ${quote(table)} WHERE (content_type = 'DRAMA' AND content_id NOT IN (SELECT id FROM dramas)) OR (content_type = 'EPISODE' AND content_id NOT IN (SELECT id FROM episodes)) OR (content_type = 'GENRE' AND content_id NOT IN (SELECT id FROM genres))`,
        `Unmapped ${table}.content_id integer reference`,
      );
    }

    for (const [table, column, parent] of references) {
      await queryRunner.query(
        `UPDATE ${quote(table)} child JOIN ${quote(parent)} parent ON child.${quote(column)} = parent.id SET child.${quote(column)} = parent.uuid`,
      );
    }

    for (const table of ['content_images', 'content_videos']) {
      await queryRunner.query(
        `UPDATE ${quote(table)} child JOIN dramas parent ON child.content_type = 'DRAMA' AND child.content_id = parent.id SET child.content_id = parent.uuid`,
      );
      await queryRunner.query(
        `UPDATE ${quote(table)} child JOIN episodes parent ON child.content_type = 'EPISODE' AND child.content_id = parent.id SET child.content_id = parent.uuid`,
      );
    }

    const modifiedReferences = new Set(
      references.map(([table, column]) => `${table}.${column}`),
    );
    for (const qualified of modifiedReferences) {
      const [table, column] = qualified.split('.');
      const nullable = references.find(
        ([refTable, refColumn]) => refTable === table && refColumn === column,
      )?.[3];
      await queryRunner.query(
        `ALTER TABLE ${quote(table)} MODIFY ${quote(column)} CHAR(36) ${nullable ? 'NULL' : 'NOT NULL'}`,
      );
    }

    for (const table of ['content_images', 'content_videos']) {
      await queryRunner.query(
        `UPDATE ${quote(table)} SET content_id = CAST(content_id AS CHAR) WHERE content_type = 'GENRE'`,
      );
      await queryRunner.query(
        `ALTER TABLE ${quote(table)} MODIFY content_id CHAR(36) NOT NULL`,
      );
    }

    for (const table of [...uuidTables].reverse()) {
      await queryRunner.query(
        `ALTER TABLE ${quote(table)} DROP INDEX ${quote(`uq_${table}_uuid`)}, DROP PRIMARY KEY, DROP COLUMN id, CHANGE COLUMN uuid id CHAR(36) NOT NULL, ADD PRIMARY KEY (id)`,
      );
    }
  }
}
