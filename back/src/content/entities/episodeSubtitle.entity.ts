import { Check, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'episode_subtitles' })
@Unique('uq_episode_subtitles_episode_id_language_code', ['episodeId', 'languageCode'])
@Index('idx_episode_subtitles_episode_id', ['episodeId'])
@Check("format IN ('VTT', 'SRT')")
export class EpisodeSubtitle extends AuditedEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid!: string;

  @Column({ name: 'episode_id', type: 'int', unsigned: true })
  episodeId!: number;

  @Column({ name: 'language_code', type: 'varchar', length: 10, default: 'ko' })
  languageCode!: string;

  @Column({ type: 'varchar', length: 10 })
  format!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;
}
