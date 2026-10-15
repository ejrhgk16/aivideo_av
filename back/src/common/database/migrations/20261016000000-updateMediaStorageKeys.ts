import type { MigrationInterface, QueryRunner } from 'typeorm';

const seedIdWhere = (alias: string, namespace: number) =>
  `${alias}.id LIKE '${String(namespace).padStart(8, '0')}-0000-4000-8000-%'`;

export class UpdateMediaStorageKeys20261016000000 implements MigrationInterface {
  name = 'UpdateMediaStorageKeys20261016000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE content_images image
      INNER JOIN dramas drama ON image.content_type = 'DRAMA' AND image.content_id = drama.id
      SET image.storage_key = CASE image.kind
        WHEN 'POSTER' THEN CONCAT('dramas/', drama.id, '/images/poster/', image.id, '.webp')
        WHEN 'HOME_HERO' THEN CONCAT('dramas/', drama.id, '/images/home-hero/', image.id, '.webp')
        WHEN 'DETAIL_COVER' THEN CONCAT('dramas/', drama.id, '/images/detail-cover/', image.id, '.webp')
        WHEN 'CAMPAIGN' THEN CONCAT('dramas/', drama.id, '/images/campaign/', image.id, '.webp')
      END
      WHERE ${seedIdWhere('image', 3)}
    `);

    await queryRunner.query(`
      UPDATE content_images image
      INNER JOIN genres genre ON image.content_type = 'GENRE' AND CAST(image.content_id AS UNSIGNED) = genre.id
      SET image.storage_key = CONCAT('genres/', genre.id, '/images/', image.id, '.webp')
      WHERE ${seedIdWhere('image', 3)}
    `);

    await queryRunner.query(`
      UPDATE content_images image
      INNER JOIN episodes episode ON image.content_type = 'EPISODE' AND image.content_id = episode.id
      SET image.storage_key = CONCAT(
        'dramas/', episode.drama_id, '/episodes/', episode.id, '/images/', image.id, '.webp'
      )
      WHERE ${seedIdWhere('image', 3)}
    `);

    await queryRunner.query(`
      UPDATE content_videos video
      INNER JOIN dramas drama ON video.content_type = 'DRAMA' AND video.content_id = drama.id
      SET video.storage_key = CONCAT('dramas/', drama.id, '/preview/', video.id, '.mp4')
      WHERE ${seedIdWhere('video', 5)}
    `);

    await queryRunner.query(`
      UPDATE content_videos video
      INNER JOIN episodes episode ON video.content_type = 'EPISODE' AND video.content_id = episode.id
      SET video.storage_key = CONCAT(
        'dramas/', episode.drama_id, '/episodes/', episode.id, '/videos/', video.id, '.mp4'
      )
      WHERE ${seedIdWhere('video', 5)}
    `);

    await queryRunner.query(`
      UPDATE episode_subtitles subtitle
      INNER JOIN episodes episode ON subtitle.episode_id = episode.id
      SET subtitle.storage_key = CONCAT(
        'dramas/', episode.drama_id, '/episodes/', episode.id, '/subtitles/',
        subtitle.language_code, '.', LOWER(subtitle.format)
      )
      WHERE ${seedIdWhere('subtitle', 6)}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE content_images image
      INNER JOIN dramas drama ON image.content_type = 'DRAMA' AND image.content_id = drama.id
      SET image.storage_key = CASE image.kind
        WHEN 'CAMPAIGN' THEN CONCAT('dramas/', drama.public_slug, '/images/campaign-', image.display_order, '.webp')
        ELSE CONCAT('dramas/', drama.public_slug, '/images/', LOWER(image.kind), '.webp')
      END
      WHERE ${seedIdWhere('image', 3)}
    `);

    await queryRunner.query(`
      UPDATE content_images image
      INNER JOIN genres genre ON image.content_type = 'GENRE' AND CAST(image.content_id AS UNSIGNED) = genre.id
      SET image.storage_key = CONCAT('genres/', LOWER(genre.code), '/tile.webp')
      WHERE ${seedIdWhere('image', 3)}
    `);

    await queryRunner.query(`
      UPDATE content_images image
      INNER JOIN episodes episode ON image.content_type = 'EPISODE' AND image.content_id = episode.id
      SET image.storage_key = CONCAT('episodes/', episode.id, '/images/cover.webp')
      WHERE ${seedIdWhere('image', 3)}
    `);

    await queryRunner.query(`
      UPDATE content_videos video
      INNER JOIN dramas drama ON video.content_type = 'DRAMA' AND video.content_id = drama.id
      SET video.storage_key = CONCAT(
        'dramas/', drama.public_slug, '/videos/preview-', video.display_order, '.mp4'
      )
      WHERE ${seedIdWhere('video', 5)}
    `);

    await queryRunner.query(`
      UPDATE content_videos video
      INNER JOIN episodes episode ON video.content_type = 'EPISODE' AND video.content_id = episode.id
      SET video.storage_key = CONCAT('episodes/', episode.id, '/full.mp4')
      WHERE ${seedIdWhere('video', 5)}
    `);

    await queryRunner.query(`
      UPDATE episode_subtitles subtitle
      INNER JOIN episodes episode ON subtitle.episode_id = episode.id
      SET subtitle.storage_key = CONCAT(
        'episodes/', episode.id, '/subtitles/', subtitle.language_code, '.', LOWER(subtitle.format)
      )
      WHERE ${seedIdWhere('subtitle', 6)}
    `);
  }
}
