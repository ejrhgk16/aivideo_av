import { MigrationInterface, QueryRunner, Table } from 'typeorm';

const auditedColumns = () => [
  {
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: 'CURRENT_TIMESTAMP(3)',
  },
  {
    name: 'updated_at',
    type: 'datetime',
    precision: 3,
    default: 'CURRENT_TIMESTAMP(3)',
  },
];

async function createAiDramaTable(
  queryRunner: QueryRunner,
  table: Table,
): Promise<void> {
  await queryRunner.createTable(table, true, false, true);
  await queryRunner.query(
    `ALTER TABLE \`${table.name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  for (const check of table.checks) {
    await queryRunner.query(
      `ALTER TABLE \`${table.name}\` ADD CONSTRAINT \`${check.name}\` CHECK (${check.expression})`,
    );
  }
}

export class InitAiDrama20261005000000 implements MigrationInterface {
  name = 'InitAiDrama20261005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'users',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'account_type', type: 'varchar', length: '16' },
          { name: 'status', type: 'varchar', length: '16' },
          {
            name: 'display_name',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'production_company_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          ...auditedColumns(),
        ],
        indices: [
          {
            name: 'idx_users_production_company_id',
            columnNames: ['production_company_id'],
          },
        ],
        checks: [
          {
            name: 'chk_users_account_type',
            expression: "account_type IN ('GUEST','MEMBER','OPERATOR','PARTNER')",
          },
          {
            name: 'chk_users_status',
            expression: "status IN ('ACTIVE','SUSPENDED','WITHDRAWN')",
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'user_preferences',
        engine: 'InnoDB',
        columns: [
          { name: 'user_id', type: 'char', length: '36', isPrimary: true },
          {
            name: 'subtitles_enabled',
            type: 'tinyint',
            width: 1,
            default: 1,
          },
          { name: 'autoplay_next', type: 'tinyint', width: 1, default: 0 },
          ...auditedColumns(),
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'production_companies',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'status', type: 'varchar', length: '16' },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'uq_production_companies_name',
            columnNames: ['name'],
          },
        ],
        checks: [
          {
            name: 'chk_production_companies_status',
            expression: "status IN ('ACTIVE','INACTIVE')",
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'dramas',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'production_company_id', type: 'char', length: '36' },
          { name: 'public_slug', type: 'varchar', length: '120' },
          { name: 'title', type: 'varchar', length: '150' },
          { name: 'short_description', type: 'varchar', length: '300' },
          { name: 'synopsis', type: 'text' },
          { name: 'status', type: 'varchar', length: '16' },
          {
            name: 'published_at',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          ...auditedColumns(),
        ],
        uniques: [
          { name: 'uq_dramas_public_slug', columnNames: ['public_slug'] },
        ],
        indices: [
          {
            name: 'idx_dramas_production_company_id',
            columnNames: ['production_company_id'],
          },
          {
            name: 'idx_dramas_status_published_at',
            columnNames: ['status', 'published_at'],
          },
          {
            name: 'idx_dramas_title_fulltext',
            columnNames: ['title'],
            isFulltext: true,
          },
        ],
        checks: [
          {
            name: 'chk_dramas_status',
            expression: "status IN ('DRAFT','REVIEW','SCHEDULED','PUBLISHED','HIDDEN')",
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'genres',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'smallint', isPrimary: true },
          { name: 'code', type: 'varchar', length: '30' },
          { name: 'name', type: 'varchar', length: '30' },
          { name: 'display_order', type: 'smallint' },
        ],
        uniques: [
          { name: 'uq_genres_code', columnNames: ['code'] },
          { name: 'uq_genres_name', columnNames: ['name'] },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'drama_genres',
        engine: 'InnoDB',
        columns: [
          { name: 'drama_id', type: 'char', length: '36', isPrimary: true },
          { name: 'genre_id', type: 'smallint', isPrimary: true },
        ],
        indices: [
          {
            name: 'idx_drama_genres_drama_id',
            columnNames: ['drama_id'],
          },
          { name: 'idx_drama_genres_genre_id', columnNames: ['genre_id'] },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'drama_images',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'drama_id', type: 'char', length: '36' },
          { name: 'kind', type: 'varchar', length: '16' },
          { name: 'storage_key', type: 'varchar', length: '500' },
          {
            name: 'alt_text',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'uq_drama_images_drama_id_kind',
            columnNames: ['drama_id', 'kind'],
          },
        ],
        indices: [
          { name: 'idx_drama_images_drama_id', columnNames: ['drama_id'] },
        ],
        checks: [
          {
            name: 'chk_drama_images_kind',
            expression: "kind IN ('POSTER','HERO','THUMBNAIL')",
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'episodes',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'drama_id', type: 'char', length: '36' },
          { name: 'episode_number', type: 'int' },
          {
            name: 'title',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          { name: 'synopsis', type: 'text', isNullable: true },
          { name: 'duration_ms', type: 'int' },
          { name: 'price_points', type: 'int', default: 0 },
          { name: 'status', type: 'varchar', length: '16' },
          {
            name: 'published_at',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'uq_episodes_drama_id_episode_number',
            columnNames: ['drama_id', 'episode_number'],
          },
        ],
        indices: [
          { name: 'idx_episodes_drama_id', columnNames: ['drama_id'] },
          { name: 'idx_episodes_status', columnNames: ['status'] },
          {
            name: 'idx_episodes_episode_number',
            columnNames: ['episode_number'],
          },
          {
            name: 'idx_episodes_status_published_at',
            columnNames: ['status', 'published_at'],
          },
        ],
        checks: [
          {
            name: 'chk_episodes_episode_number',
            expression: 'episode_number > 0',
          },
          { name: 'chk_episodes_duration_ms', expression: 'duration_ms > 0' },
          {
            name: 'chk_episodes_price_points',
            expression: 'price_points >= 0',
          },
          {
            name: 'chk_episodes_status',
            expression: "status IN ('DRAFT','REVIEW','SCHEDULED','PUBLISHED','HIDDEN')",
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'episode_videos',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'episode_id', type: 'char', length: '36' },
          { name: 'kind', type: 'varchar', length: '16' },
          { name: 'storage_key', type: 'varchar', length: '500' },
          {
            name: 'thumbnail_key',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          { name: 'duration_ms', type: 'int' },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'uq_episode_videos_episode_id_kind',
            columnNames: ['episode_id', 'kind'],
          },
        ],
        indices: [
          { name: 'idx_episode_videos_episode_id', columnNames: ['episode_id'] },
        ],
        checks: [
          {
            name: 'chk_episode_videos_kind',
            expression: "kind IN ('FULL','PREVIEW')",
          },
          {
            name: 'chk_episode_videos_duration_ms',
            expression: 'duration_ms > 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'episode_subtitles',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'episode_id', type: 'char', length: '36' },
          {
            name: 'language_code',
            type: 'varchar',
            length: '10',
            default: "'ko'",
          },
          { name: 'format', type: 'varchar', length: '10' },
          { name: 'storage_key', type: 'varchar', length: '500' },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'uq_episode_subtitles_episode_id_language_code',
            columnNames: ['episode_id', 'language_code'],
          },
        ],
        indices: [
          {
            name: 'idx_episode_subtitles_episode_id',
            columnNames: ['episode_id'],
          },
        ],
        checks: [
          {
            name: 'chk_episode_subtitles_format',
            expression: "format IN ('VTT','SRT')",
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'content_collections',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'code', type: 'varchar', length: '50' },
          { name: 'title', type: 'varchar', length: '100' },
          {
            name: 'description',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          { name: 'kind', type: 'varchar', length: '24' },
          { name: 'is_active', type: 'tinyint', width: 1, default: 0 },
          ...auditedColumns(),
        ],
        uniques: [
          { name: 'UQ_content_collections_code', columnNames: ['code'] },
        ],
        checks: [
          {
            name: 'CHK_content_collections_kind',
            expression: "kind IN ('HOME','EDITORIAL_RANKING','RECOMMENDATION_FEED')",
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'collection_dramas',
        engine: 'InnoDB',
        columns: [
          {
            name: 'collection_id',
            type: 'char',
            length: '36',
            isPrimary: true,
          },
          { name: 'drama_id', type: 'char', length: '36', isPrimary: true },
          { name: 'display_order', type: 'smallint' },
          {
            name: 'starts_at',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          {
            name: 'ends_at',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'UQ_collection_dramas_collection_id_display_order',
            columnNames: ['collection_id', 'display_order'],
          },
        ],
        checks: [
          {
            name: 'CHK_collection_dramas_display_order',
            expression: 'display_order > 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'user_saved_dramas',
        engine: 'InnoDB',
        columns: [
          { name: 'user_id', type: 'char', length: '36', isPrimary: true },
          { name: 'drama_id', type: 'char', length: '36', isPrimary: true },
          {
            name: 'saved_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
          },
        ],
        indices: [
          {
            name: 'IDX_user_saved_dramas_user_id_saved_at',
            columnNames: ['user_id', 'saved_at'],
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'user_watch_progress',
        engine: 'InnoDB',
        columns: [
          { name: 'user_id', type: 'char', length: '36', isPrimary: true },
          { name: 'episode_id', type: 'char', length: '36', isPrimary: true },
          { name: 'position_ms', type: 'int', default: 0 },
          { name: 'is_completed', type: 'tinyint', width: 1, default: 0 },
          {
            name: 'last_played_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
          },
          ...auditedColumns(),
        ],
        indices: [
          {
            name: 'IDX_user_watch_progress_user_id_last_played_at',
            columnNames: ['user_id', 'last_played_at'],
          },
        ],
        checks: [
          {
            name: 'CHK_user_watch_progress_position_ms',
            expression: 'position_ms >= 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'user_preview_feed_states',
        engine: 'InnoDB',
        columns: [
          { name: 'user_id', type: 'char', length: '36', isPrimary: true },
          {
            name: 'collection_id',
            type: 'char',
            length: '36',
            isPrimary: true,
          },
          { name: 'drama_id', type: 'char', length: '36' },
          { name: 'position_ms', type: 'int', default: 0 },
          {
            name: 'updated_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
          },
        ],
        checks: [
          {
            name: 'CHK_user_preview_feed_states_position_ms',
            expression: 'position_ms >= 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'wallets',
        engine: 'InnoDB',
        columns: [
          { name: 'user_id', type: 'char', length: '36', isPrimary: true },
          { name: 'available_points', type: 'int', default: 0 },
          ...auditedColumns(),
        ],
        checks: [
          {
            name: 'chk_wallets_available_points_non_negative',
            expression: 'available_points >= 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'point_transactions',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'wallet_user_id', type: 'char', length: '36' },
          { name: 'transaction_type', type: 'varchar', length: '24' },
          { name: 'amount', type: 'int' },
          { name: 'balance_after', type: 'int' },
          { name: 'idempotency_key', type: 'varchar', length: '100' },
          {
            name: 'memo',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
          },
        ],
        uniques: [
          {
            name: 'uq_point_transactions_idempotency_key',
            columnNames: ['idempotency_key'],
          },
        ],
        indices: [
          {
            name: 'idx_point_transactions_wallet_created_at',
            columnNames: ['wallet_user_id', 'created_at'],
          },
        ],
        checks: [
          {
            name: 'chk_point_transactions_transaction_type',
            expression: "transaction_type IN ('PURCHASE','AD_REWARD','EPISODE_UNLOCK','ADMIN_ADJUSTMENT','REFUND')",
          },
          {
            name: 'chk_point_transactions_amount_nonzero',
            expression: 'amount <> 0',
          },
          {
            name: 'chk_point_transactions_balance_after_non_negative',
            expression: 'balance_after >= 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'episode_entitlements',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'user_id', type: 'char', length: '36' },
          { name: 'episode_id', type: 'char', length: '36' },
          { name: 'acquisition_type', type: 'varchar', length: '20' },
          {
            name: 'unlock_transaction_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'granted_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
          },
        ],
        uniques: [
          {
            name: 'uq_episode_entitlements_user_episode',
            columnNames: ['user_id', 'episode_id'],
          },
          {
            name: 'uq_episode_entitlements_unlock_transaction_id',
            columnNames: ['unlock_transaction_id'],
          },
        ],
        indices: [
          {
            name: 'idx_episode_entitlements_user_episode',
            columnNames: ['user_id', 'episode_id'],
          },
        ],
        checks: [
          {
            name: 'chk_episode_entitlements_acquisition_type',
            expression: "acquisition_type IN ('POINT_PURCHASE','ADMIN_GRANT','REFUND_RESTORE')",
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'point_products',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'code', type: 'varchar', length: '50' },
          { name: 'points', type: 'int' },
          { name: 'price_krw', type: 'int' },
          { name: 'is_active', type: 'tinyint', width: 1, default: 1 },
          ...auditedColumns(),
        ],
        uniques: [{ name: 'uq_point_products_code', columnNames: ['code'] }],
        checks: [
          {
            name: 'chk_point_products_points_positive',
            expression: 'points > 0',
          },
          {
            name: 'chk_point_products_price_krw_positive',
            expression: 'price_krw > 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'point_purchase_orders',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'user_id', type: 'char', length: '36' },
          { name: 'point_product_id', type: 'char', length: '36' },
          { name: 'points', type: 'int' },
          { name: 'price_krw', type: 'int' },
          { name: 'status', type: 'varchar', length: '16' },
          {
            name: 'payment_provider',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          {
            name: 'external_payment_id',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'award_transaction_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          ...auditedColumns(),
          {
            name: 'paid_at',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'uq_point_purchase_orders_external_payment_id',
            columnNames: ['external_payment_id'],
          },
          {
            name: 'uq_point_purchase_orders_award_transaction_id',
            columnNames: ['award_transaction_id'],
          },
        ],
        indices: [
          {
            name: 'idx_point_purchase_orders_user_created_at',
            columnNames: ['user_id', 'created_at'],
          },
        ],
        checks: [
          {
            name: 'chk_point_purchase_orders_status',
            expression: "status IN ('PENDING','PAID','FAILED','CANCELLED','REFUNDED')",
          },
          {
            name: 'chk_point_purchase_orders_points_positive',
            expression: 'points > 0',
          },
          {
            name: 'chk_point_purchase_orders_price_krw_positive',
            expression: 'price_krw > 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'ad_reward_offers',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'code', type: 'varchar', length: '50' },
          { name: 'reward_points', type: 'int' },
          { name: 'daily_limit', type: 'smallint' },
          { name: 'is_active', type: 'tinyint', width: 1, default: 1 },
          ...auditedColumns(),
        ],
        uniques: [
          { name: 'uq_ad_reward_offers_code', columnNames: ['code'] },
        ],
        checks: [
          {
            name: 'chk_ad_reward_offers_reward_points_positive',
            expression: 'reward_points > 0',
          },
          {
            name: 'chk_ad_reward_offers_daily_limit_positive',
            expression: 'daily_limit > 0',
          },
        ],
      }),
    );

    await createAiDramaTable(
      queryRunner,
      new Table({
        name: 'ad_reward_claims',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'user_id', type: 'char', length: '36' },
          { name: 'ad_reward_offer_id', type: 'char', length: '36' },
          { name: 'status', type: 'varchar', length: '16' },
          { name: 'reward_date_kst', type: 'date' },
          {
            name: 'provider_event_id',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'reward_transaction_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
          },
          {
            name: 'completed_at',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'uq_ad_reward_claims_provider_event_id',
            columnNames: ['provider_event_id'],
          },
          {
            name: 'uq_ad_reward_claims_reward_transaction_id',
            columnNames: ['reward_transaction_id'],
          },
        ],
        indices: [
          {
            name: 'idx_ad_reward_claims_user_offer_date_status',
            columnNames: [
              'user_id',
              'ad_reward_offer_id',
              'reward_date_kst',
              'status',
            ],
          },
        ],
        checks: [
          {
            name: 'chk_ad_reward_claims_status',
            expression: "status IN ('STARTED','COMPLETED','ABANDONED','REJECTED')",
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ad_reward_claims', true, true);
    await queryRunner.dropTable('ad_reward_offers', true, true);
    await queryRunner.dropTable('point_purchase_orders', true, true);
    await queryRunner.dropTable('point_products', true, true);
    await queryRunner.dropTable('episode_entitlements', true, true);
    await queryRunner.dropTable('point_transactions', true, true);
    await queryRunner.dropTable('wallets', true, true);
    await queryRunner.dropTable('user_preview_feed_states', true, true);
    await queryRunner.dropTable('user_watch_progress', true, true);
    await queryRunner.dropTable('user_saved_dramas', true, true);
    await queryRunner.dropTable('collection_dramas', true, true);
    await queryRunner.dropTable('content_collections', true, true);
    await queryRunner.dropTable('episode_subtitles', true, true);
    await queryRunner.dropTable('episode_videos', true, true);
    await queryRunner.dropTable('episodes', true, true);
    await queryRunner.dropTable('drama_images', true, true);
    await queryRunner.dropTable('drama_genres', true, true);
    await queryRunner.dropTable('genres', true, true);
    await queryRunner.dropTable('dramas', true, true);
    await queryRunner.dropTable('production_companies', true, true);
    await queryRunner.dropTable('user_preferences', true, true);
    await queryRunner.dropTable('users', true, true);
  }
}
