import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'user_watch_progress' })
@Index('IDX_user_watch_progress_user_id_last_played_at', [
  'userId',
  'lastPlayedAt',
])
@Check('CHK_user_watch_progress_position_ms', 'position_ms >= 0')
export class UserWatchProgress extends AuditedEntity {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @PrimaryColumn({ name: 'episode_id', type: 'char', length: 36 })
  episodeId!: string;

  @Column({ name: 'position_ms', type: 'int', default: 0 })
  positionMs!: number;

  @Column({ name: 'is_completed', type: 'tinyint', width: 1, default: 0 })
  isCompleted!: boolean;

  @Column({
    name: 'last_played_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  lastPlayedAt!: Date;
}
