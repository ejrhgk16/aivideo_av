import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'ad_reward_claims' })
@Index('idx_ad_reward_claims_user_offer_date_status', [
  'userId',
  'adRewardOfferId',
  'rewardDateKst',
  'status',
])
@Check(
  'chk_ad_reward_claims_status',
  "status IN ('STARTED','COMPLETED','ABANDONED','REJECTED')",
)
export class AdRewardClaim extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @Column({ name: 'ad_reward_offer_id', type: 'char', length: 36 })
  adRewardOfferId!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'reward_date_kst', type: 'date' })
  rewardDateKst!: string;

  @Column({
    name: 'provider_event_id',
    type: 'varchar',
    length: 200,
    nullable: true,
    unique: true,
  })
  providerEventId!: string | null;

  @Column({
    name: 'reward_transaction_id',
    type: 'char',
    length: 36,
    nullable: true,
    unique: true,
  })
  rewardTransactionId!: string | null;

  @Column({
    name: 'started_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true })
  completedAt!: Date | null;
}
