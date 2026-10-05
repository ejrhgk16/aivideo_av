import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'wallets' })
@Check('chk_wallets_available_points_non_negative', 'available_points >= 0')
export class Wallet extends AuditedEntity {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @Column({ name: 'available_points', type: 'int', default: 0 })
  availablePoints!: number;
}
