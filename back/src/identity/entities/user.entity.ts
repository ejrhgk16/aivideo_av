import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'users' })
@Index('idx_users_production_company_id', ['productionCompanyId'])
@Check("account_type IN ('GUEST', 'MEMBER', 'OPERATOR', 'PARTNER')")
@Check("status IN ('ACTIVE', 'SUSPENDED', 'WITHDRAWN')")
export class User extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'account_type', type: 'varchar', length: 16 })
  accountType!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 50, nullable: true })
  displayName!: string | null;

  @Column({
    name: 'production_company_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  productionCompanyId!: string | null;
}
