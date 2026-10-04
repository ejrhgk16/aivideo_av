import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'point_products' })
@Check('chk_point_products_points_positive', 'points > 0')
@Check('chk_point_products_price_krw_positive', 'price_krw > 0')
export class PointProduct extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'int' })
  points!: number;

  @Column({ name: 'price_krw', type: 'int' })
  priceKrw!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;
}
