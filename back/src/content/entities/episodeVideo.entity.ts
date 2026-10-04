import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'episode_videos' })
@Unique('uq_episode_videos_episode_id_kind', ['episodeId', 'kind'])
@Index('idx_episode_videos_episode_id', ['episodeId'])
@Check("kind IN ('FULL', 'PREVIEW')")
@Check('duration_ms > 0')
export class EpisodeVideo extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'episode_id', type: 'char', length: 36 })
  episodeId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ name: 'thumbnail_key', type: 'varchar', length: 500, nullable: true })
  thumbnailKey!: string | null;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs!: number;
}
