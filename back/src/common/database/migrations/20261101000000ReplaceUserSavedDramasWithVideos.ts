import { Table, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm';

function table(name: 'user_saved_videos' | 'user_saved_dramas'): Table {
  const video = name === 'user_saved_videos';
  return new Table({
    name,
    engine: 'InnoDB',
    columns: [
      { name: 'user_id', type: 'int', unsigned: true, isPrimary: true },
      { name: video ? 'video_id' : 'drama_id', type: 'int', unsigned: true, isPrimary: true },
      ...(video ? [{ name: 'content_type', type: 'varchar', length: '16' }] : []),
      { name: 'saved_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)' },
    ],
    indices: [new TableIndex({
      name: `IDX_${name}_user_id_saved_at`,
      columnNames: ['user_id', 'saved_at'],
    })],
  });
}

async function create(queryRunner: QueryRunner, name: 'user_saved_videos' | 'user_saved_dramas'): Promise<void> {
  await queryRunner.createTable(table(name));
  await queryRunner.query(`ALTER TABLE \`${name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  if (name === 'user_saved_videos') {
    await queryRunner.query("ALTER TABLE `user_saved_videos` ADD CONSTRAINT `CHK_user_saved_videos_content_type` CHECK (content_type IN ('EPISODE','PREVIEW'))");
  }
}

export class ReplaceUserSavedDramasWithVideos20261101000000 implements MigrationInterface {
  name = 'ReplaceUserSavedDramasWithVideos20261101000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_saved_dramas')) || await queryRunner.hasTable('user_saved_videos')) {
      throw new Error('Expected user_saved_dramas only; inspect schema before migration.');
    }
    await create(queryRunner, 'user_saved_videos');
    await queryRunner.dropTable('user_saved_dramas');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_saved_dramas') || !(await queryRunner.hasTable('user_saved_videos'))) {
      throw new Error('Expected user_saved_videos only; inspect schema before rollback.');
    }
    const savedCount = await queryRunner.manager
      .createQueryBuilder()
      .from('user_saved_videos', 'savedVideo')
      .getCount();
    if (savedCount !== 0) {
      throw new Error('Cannot restore drama-only schema while saved videos exist.');
    }
    await create(queryRunner, 'user_saved_dramas');
    await queryRunner.dropTable('user_saved_videos');
  }
}
