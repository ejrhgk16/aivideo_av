import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLandscapePoster20261019000000 implements MigrationInterface {
  name = 'AddLandscapePoster20261019000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_images
      DROP CHECK chk_content_images_kind,
      ADD CONSTRAINT chk_content_images_kind
        CHECK (kind IN ('POSTER','POSTER_LANDSCAPE','HOME_HERO','DETAIL_COVER','CAMPAIGN','GENRE_TILE','EPISODE_COVER'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_images
      DROP CHECK chk_content_images_kind,
      ADD CONSTRAINT chk_content_images_kind
        CHECK (kind IN ('POSTER','HOME_HERO','DETAIL_COVER','CAMPAIGN','GENRE_TILE','EPISODE_COVER'))
    `);
  }
}
