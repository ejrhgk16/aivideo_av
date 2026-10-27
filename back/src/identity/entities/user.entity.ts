import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'users' })
@Index('idx_users_production_company_id', ['productionCompanyId'])
@Index('uq_users_login_id', ['loginId'], { unique: true })
@Check("account_type IN ('GUEST', 'MEMBER', 'OPERATOR', 'PARTNER')")
@Check("status IN ('ACTIVE', 'SUSPENDED', 'WITHDRAWN')")
export class User extends AuditedEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid!: string;

  @Column({ name: 'login_id', type: 'varchar', length: 100, nullable: true })
  loginId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password!: string | null;

  @Column({ name: 'account_type', type: 'varchar', length: 16 })
  accountType!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 50, nullable: true })
  displayName!: string | null;

  @Column({
    name: 'production_company_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  productionCompanyId!: string | null;
}
