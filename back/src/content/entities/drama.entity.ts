import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'dramas' })
@Unique('uq_dramas_public_slug', ['publicSlug'])
@Index('idx_dramas_production_company_id', ['productionCompanyId'])
@Index('idx_dramas_status_published_at', ['status', 'publishedAt'])
@Check("status IN ('DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'HIDDEN')")
export class Drama extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'production_company_id', type: 'char', length: 36 })
  productionCompanyId!: string;

  @Column({ name: 'public_slug', type: 'varchar', length: 120 })
  publicSlug!: string;

  @Index('idx_dramas_title_fulltext', { fulltext: true })
  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'short_description', type: 'varchar', length: 300 })
  shortDescription!: string;

  @Column({ type: 'text' })
  synopsis!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'published_at', type: 'datetime', precision: 3, nullable: true })
  publishedAt!: Date | null;
}
