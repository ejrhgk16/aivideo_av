import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'content_videos' })
@Unique(
  'uq_content_videos_content_type_content_id_kind_display_order',
  ['contentType', 'contentId', 'kind', 'displayOrder'],
)
@Index('idx_content_videos_content_type_content_id', [
  'contentType',
  'contentId',
])
@Check("content_type IN ('DRAMA','EPISODE')")
@Check("kind IN ('FULL','PREVIEW')")
@Check('duration_ms > 0')
@Check('display_order > 0')
export class ContentVideo extends AuditedEntity {
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

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs!: number;

  @Column({ name: 'display_order', type: 'smallint' })
  displayOrder!: number;
}
