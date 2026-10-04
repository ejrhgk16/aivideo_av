import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'episodes' })
@Unique('uq_episodes_drama_id_episode_number', ['dramaId', 'episodeNumber'])
@Index('idx_episodes_drama_id', ['dramaId'])
@Index('idx_episodes_status', ['status'])
@Index('idx_episodes_episode_number', ['episodeNumber'])
@Index('idx_episodes_status_published_at', ['status', 'publishedAt'])
@Check('episode_number > 0')
@Check('duration_ms > 0')
@Check('price_points >= 0')
@Check("status IN ('DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'HIDDEN')")
export class Episode extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'drama_id', type: 'char', length: 36 })
  dramaId!: string;

  @Column({ name: 'episode_number', type: 'int' })
  episodeNumber!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  synopsis!: string | null;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs!: number;

  @Column({ name: 'price_points', type: 'int', default: 0 })
  pricePoints!: number;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'published_at', type: 'datetime', precision: 3, nullable: true })
  publishedAt!: Date | null;
}
