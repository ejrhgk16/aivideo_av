import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'drama_images' })
@Unique('uq_drama_images_drama_id_kind', ['dramaId', 'kind'])
@Index('idx_drama_images_drama_id', ['dramaId'])
@Check("kind IN ('POSTER', 'HERO', 'THUMBNAIL')")
export class DramaImage extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'drama_id', type: 'char', length: 36 })
  dramaId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ name: 'alt_text', type: 'varchar', length: 200, nullable: true })
  altText!: string | null;
}
