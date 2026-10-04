import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'production_companies' })
@Unique('uq_production_companies_name', ['name'])
@Check("status IN ('ACTIVE', 'INACTIVE')")
export class ProductionCompany extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;
}
