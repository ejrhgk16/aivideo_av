import { Column, Entity, PrimaryColumn } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'user_preferences' })
export class UserPreference extends AuditedEntity {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @Column({ name: 'subtitles_enabled', type: 'tinyint', width: 1, default: 1 })
  subtitlesEnabled!: number;

  @Column({ name: 'autoplay_next', type: 'tinyint', width: 1, default: 0 })
  autoplayNext!: number;
}
