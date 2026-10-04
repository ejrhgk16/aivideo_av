import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'content_collections' })
@Unique('UQ_content_collections_code', ['code'])
@Check(
  'CHK_content_collections_kind',
  `kind IN ('HOME', 'EDITORIAL_RANKING', 'RECOMMENDATION_FEED')`,
)
export class ContentCollection extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 24 })
  kind!: string;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 0 })
  isActive!: boolean;
}
