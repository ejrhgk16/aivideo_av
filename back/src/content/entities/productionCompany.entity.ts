import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'production_companies' })
@Unique('uq_production_companies_name', ['name'])
@Check("status IN ('ACTIVE', 'INACTIVE')")
export class ProductionCompany extends AuditedEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;
}
