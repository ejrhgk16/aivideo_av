import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'episode_subtitles' })
@Unique('uq_episode_subtitles_episode_id_language_code', ['episodeId', 'languageCode'])
@Index('idx_episode_subtitles_episode_id', ['episodeId'])
@Check("format IN ('VTT', 'SRT')")
export class EpisodeSubtitle extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'episode_id', type: 'char', length: 36 })
  episodeId!: string;

  @Column({ name: 'language_code', type: 'varchar', length: 10, default: 'ko' })
  languageCode!: string;

  @Column({ type: 'varchar', length: 10 })
  format!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;
}
