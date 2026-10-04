import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'episode_entitlements' })
@Index('idx_episode_entitlements_user_episode', ['userId', 'episodeId'])
@Unique('uq_episode_entitlements_user_episode', ['userId', 'episodeId'])
@Check(
  'chk_episode_entitlements_acquisition_type',
  "acquisition_type IN ('POINT_PURCHASE','ADMIN_GRANT','REFUND_RESTORE')",
)
export class EpisodeEntitlement {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @Column({ name: 'episode_id', type: 'char', length: 36 })
  episodeId!: string;

  @Column({ name: 'acquisition_type', type: 'varchar', length: 20 })
  acquisitionType!: string;

  @Column({
    name: 'unlock_transaction_id',
    type: 'char',
    length: 36,
    nullable: true,
    unique: true,
  })
  unlockTransactionId!: string | null;

  @Column({
    name: 'granted_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  grantedAt!: Date;
}
