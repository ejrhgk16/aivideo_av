import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
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
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid!: string;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId!: number;

  @Column({ name: 'episode_id', type: 'int', unsigned: true })
  episodeId!: number;

  @Column({ name: 'acquisition_type', type: 'varchar', length: 20 })
  acquisitionType!: string;

  @Column({
    name: 'unlock_transaction_id',
    type: 'int',
    unsigned: true,
    nullable: true,
    unique: true,
  })
  unlockTransactionId!: number | null;

  @Column({
    name: 'granted_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  grantedAt!: Date;
}
