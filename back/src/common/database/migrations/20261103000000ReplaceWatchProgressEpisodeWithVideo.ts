import type { MigrationInterface, QueryRunner, Table } from 'typeorm';

const tableName = 'user_watch_progress';
const userIndex = 'IDX_user_watch_progress_user_id_last_played_at';
const videoIndex = 'idx_user_watch_progress_video_id';
const positionCheck = 'CHK_user_watch_progress_position_ms';

const quote = (identifier: string) => `\`${identifier}\``;

function assertSchema(
  table: Table | undefined,
  keyColumn: 'episode_id' | 'video_id',
  otherColumn: 'video_id' | 'episode_id',
  keyIndex?: string,
): void {
  if (!table) {
    throw new Error(`Expected ${tableName} table; inspect schema before migration.`);
  }

  const expectedColumns = [
    'user_id',
    keyColumn,
    'position_ms',
    'is_completed',
    'last_played_at',
    'created_at',
    'updated_at',
  ].sort();
  const actualColumns = table.columns.map(({ name }) => name).sort();
  const userColumn = table.columns.find(({ name }) => name === 'user_id');
  const key = table.columns.find(({ name }) => name === keyColumn);
  const primaryColumns = table.primaryColumns.map(({ name }) => name);
  const userRecentIndex = table.indices.find(({ name }) => name === userIndex);
  const keyLookupIndex = keyIndex
    ? table.indices.find(({ name }) => name === keyIndex)
    : undefined;
  if (
    actualColumns.join(',') !== expectedColumns.join(',') ||
    actualColumns.includes(otherColumn) ||
    userColumn?.type !== 'int' || userColumn.unsigned !== true || userColumn.isNullable ||
    key?.type !== 'int' || key.unsigned !== true || key.isNullable ||
    primaryColumns.join(',') !== `user_id,${keyColumn}` ||
    !userRecentIndex ||
    userRecentIndex.columnNames.join(',') !== 'user_id,last_played_at' ||
    (keyIndex !== undefined && !keyLookupIndex) ||
    (keyLookupIndex && keyLookupIndex.columnNames.join(',') !== keyColumn)
  ) {
    throw new Error(`Unexpected ${tableName} schema; inspect schema before migration.`);
  }
}

async function assertPositionCheck(queryRunner: QueryRunner): Promise<void> {
  const checks = (await queryRunner.query(
    `SELECT check_constraint.CHECK_CLAUSE AS expression
     FROM information_schema.TABLE_CONSTRAINTS table_constraint
     INNER JOIN information_schema.CHECK_CONSTRAINTS check_constraint
       ON check_constraint.CONSTRAINT_SCHEMA = table_constraint.CONSTRAINT_SCHEMA
       AND check_constraint.CONSTRAINT_NAME = table_constraint.CONSTRAINT_NAME
     WHERE table_constraint.CONSTRAINT_SCHEMA = DATABASE()
       AND table_constraint.TABLE_NAME = ?
       AND table_constraint.CONSTRAINT_NAME = ?
       AND table_constraint.CONSTRAINT_TYPE = 'CHECK'`,
    [tableName, positionCheck],
  )) as { expression: string }[];
  const expression = checks[0]?.expression?.replace(/[`()\s]/g, '').toLowerCase();
  if (expression !== 'position_ms>=0') {
    throw new Error(`Expected ${positionCheck} on ${tableName}; inspect schema before migration.`);
  }
}

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

export class ReplaceWatchProgressEpisodeWithVideo20261103000000
  implements MigrationInterface
{
  name = 'ReplaceWatchProgressEpisodeWithVideo20261103000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    assertSchema(await queryRunner.getTable(tableName) ?? undefined, 'episode_id', 'video_id');
    await assertPositionCheck(queryRunner);

    await assertNoRows(
      queryRunner,
      `SELECT COUNT(*) AS count
       FROM ${quote(tableName)} progress
       LEFT JOIN episodes episode ON episode.id = progress.episode_id
       LEFT JOIN content_videos video
         ON video.content_type = 'EPISODE'
         AND video.content_id = episode.id
         AND video.kind = 'FULL'
         AND video.display_order = (
           SELECT MIN(candidate.display_order)
           FROM content_videos candidate
           WHERE candidate.content_type = 'EPISODE'
             AND candidate.content_id = episode.id
             AND candidate.kind = 'FULL'
         )
       WHERE episode.id IS NULL OR video.id IS NULL`,
      'Cannot map every watch-progress row to an EPISODE FULL video',
    );

    await queryRunner.query(
      `ALTER TABLE ${quote(tableName)} ADD COLUMN video_id INT UNSIGNED NULL AFTER user_id`,
    );
    await queryRunner.query(
      `UPDATE ${quote(tableName)} progress
       INNER JOIN content_videos video
         ON video.content_type = 'EPISODE'
         AND video.content_id = progress.episode_id
         AND video.kind = 'FULL'
         AND video.display_order = (
           SELECT MIN(candidate.display_order)
           FROM content_videos candidate
           WHERE candidate.content_type = 'EPISODE'
             AND candidate.content_id = progress.episode_id
             AND candidate.kind = 'FULL'
         )
       SET progress.video_id = video.id`,
    );
    await assertNoRows(
      queryRunner,
      `SELECT COUNT(*) AS count FROM ${quote(tableName)} WHERE video_id IS NULL`,
      'Watch-progress video backfill left unmapped rows',
    );
    await queryRunner.query(
      `ALTER TABLE ${quote(tableName)}
         DROP PRIMARY KEY,
         DROP COLUMN episode_id,
         MODIFY COLUMN video_id INT UNSIGNED NOT NULL,
         ADD PRIMARY KEY (user_id, video_id),
         ADD INDEX ${quote(videoIndex)} (video_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    assertSchema(await queryRunner.getTable(tableName) ?? undefined, 'video_id', 'episode_id', videoIndex);
    await assertPositionCheck(queryRunner);

    await assertNoRows(
      queryRunner,
      `SELECT COUNT(*) AS count
       FROM ${quote(tableName)} progress
       LEFT JOIN content_videos video ON video.id = progress.video_id
       LEFT JOIN episodes episode
         ON video.content_type = 'EPISODE' AND episode.id = video.content_id
       WHERE video.id IS NULL OR video.kind <> 'FULL' OR episode.id IS NULL`,
      'Cannot restore episode progress for a missing or non-EPISODE FULL video',
    );
    await assertNoRows(
      queryRunner,
      `SELECT COUNT(*) AS count
       FROM (
         SELECT progress.user_id, video.content_id
         FROM ${quote(tableName)} progress
         INNER JOIN content_videos video ON video.id = progress.video_id
         GROUP BY progress.user_id, video.content_id
         HAVING COUNT(*) > 1
       ) duplicates`,
      'Cannot restore episode progress without losing multiple video records',
    );

    await queryRunner.query(
      `ALTER TABLE ${quote(tableName)} ADD COLUMN episode_id INT UNSIGNED NULL AFTER user_id`,
    );
    await queryRunner.query(
      `UPDATE ${quote(tableName)} progress
       INNER JOIN content_videos video ON video.id = progress.video_id
       SET progress.episode_id = video.content_id`,
    );
    await assertNoRows(
      queryRunner,
      `SELECT COUNT(*) AS count FROM ${quote(tableName)} WHERE episode_id IS NULL`,
      'Watch-progress episode backfill left unmapped rows',
    );
    await queryRunner.query(
      `ALTER TABLE ${quote(tableName)}
         DROP PRIMARY KEY,
         DROP INDEX ${quote(videoIndex)},
         DROP COLUMN video_id,
         MODIFY COLUMN episode_id INT UNSIGNED NOT NULL,
         ADD PRIMARY KEY (user_id, episode_id)`,
    );
  }
}
