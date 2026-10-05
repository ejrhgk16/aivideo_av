import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'ad_reward_offers' })
@Check('chk_ad_reward_offers_reward_points_positive', 'reward_points > 0')
@Check('chk_ad_reward_offers_daily_limit_positive', 'daily_limit > 0')
export class AdRewardOffer extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ name: 'reward_points', type: 'int' })
  rewardPoints!: number;

  @Column({ name: 'daily_limit', type: 'smallint' })
  dailyLimit!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;
}
