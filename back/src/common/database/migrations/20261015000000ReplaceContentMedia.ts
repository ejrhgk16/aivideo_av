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

async function createTableWithChecks(
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

export class ReplaceContentMedia20261015000000 implements MigrationInterface {
  name = 'ReplaceContentMedia20261015000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('episode_videos', true, true);
    await queryRunner.dropTable('drama_images', true, true);

    await createTableWithChecks(
      queryRunner,
      new Table({
        name: 'content_images',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'content_type', type: 'varchar', length: '16' },
          { name: 'content_id', type: 'char', length: '36' },
          { name: 'kind', type: 'varchar', length: '16' },
          { name: 'storage_key', type: 'varchar', length: '500' },
          {
            name: 'alt_text',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          { name: 'display_order', type: 'smallint' },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'uq_content_images_content_type_content_id_kind_display_order',
            columnNames: [
              'content_type',
              'content_id',
              'kind',
              'display_order',
            ],
          },
        ],
        indices: [
          {
            name: 'idx_content_images_content_type_content_id',
            columnNames: ['content_type', 'content_id'],
          },
        ],
        checks: [
          {
            name: 'chk_content_images_content_type',
            expression: "content_type IN ('DRAMA','GENRE','EPISODE')",
          },
          {
            name: 'chk_content_images_kind',
            expression:
              "kind IN ('POSTER','HOME_HERO','DETAIL_COVER','CAMPAIGN','GENRE_TILE','EPISODE_COVER')",
          },
        ],
      }),
    );

    await createTableWithChecks(
      queryRunner,
      new Table({
        name: 'content_videos',
        engine: 'InnoDB',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'content_type', type: 'varchar', length: '16' },
          { name: 'content_id', type: 'char', length: '36' },
          { name: 'kind', type: 'varchar', length: '16' },
          { name: 'storage_key', type: 'varchar', length: '500' },
          { name: 'duration_ms', type: 'int' },
          { name: 'display_order', type: 'smallint' },
          ...auditedColumns(),
        ],
        uniques: [
          {
            name: 'uq_content_videos_content_type_content_id_kind_display_order',
            columnNames: [
              'content_type',
              'content_id',
              'kind',
              'display_order',
            ],
          },
        ],
        indices: [
          {
            name: 'idx_content_videos_content_type_content_id',
            columnNames: ['content_type', 'content_id'],
          },
        ],
        checks: [
          {
            name: 'chk_content_videos_content_type',
            expression: "content_type IN ('DRAMA','EPISODE')",
          },
          {
            name: 'chk_content_videos_kind',
            expression: "kind IN ('FULL','PREVIEW')",
          },
          {
            name: 'chk_content_videos_duration_ms',
            expression: 'duration_ms > 0',
          },
          {
            name: 'chk_content_videos_display_order',
            expression: 'display_order > 0',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('content_videos', true, true);
    await queryRunner.dropTable('content_images', true, true);

    await createTableWithChecks(
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

    await createTableWithChecks(
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
  }
}
