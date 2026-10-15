import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'content_images' })
@Unique(
  'uq_content_images_content_type_content_id_kind_display_order',
  ['contentType', 'contentId', 'kind', 'displayOrder'],
)
@Index('idx_content_images_content_type_content_id', [
  'contentType',
  'contentId',
])
@Check("content_type IN ('DRAMA','GENRE','EPISODE')")
@Check(
  "kind IN ('POSTER','HOME_HERO','DETAIL_COVER','CAMPAIGN','GENRE_TILE','EPISODE_COVER')",
)
export class ContentImage extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 16 })
  contentType!: string;

  @Column({ name: 'content_id', type: 'char', length: 36 })
  contentId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ name: 'alt_text', type: 'varchar', length: 200, nullable: true })
  altText!: string | null;

  @Column({ name: 'display_order', type: 'smallint' })
  displayOrder!: number;
}
