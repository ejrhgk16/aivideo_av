import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'point_purchase_orders' })
@Index('idx_point_purchase_orders_user_created_at', ['userId', 'createdAt'])
@Check(
  'chk_point_purchase_orders_status',
  "status IN ('PENDING','PAID','FAILED','CANCELLED','REFUNDED')",
)
@Check('chk_point_purchase_orders_points_positive', 'points > 0')
@Check('chk_point_purchase_orders_price_krw_positive', 'price_krw > 0')
export class PointPurchaseOrder extends AuditedEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @Column({ name: 'point_product_id', type: 'char', length: 36 })
  pointProductId!: string;

  @Column({ type: 'int' })
  points!: number;

  @Column({ name: 'price_krw', type: 'int' })
  priceKrw!: number;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({
    name: 'payment_provider',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  paymentProvider!: string | null;

  @Column({
    name: 'external_payment_id',
    type: 'varchar',
    length: 200,
    nullable: true,
    unique: true,
  })
  externalPaymentId!: string | null;

  @Column({
    name: 'award_transaction_id',
    type: 'char',
    length: 36,
    nullable: true,
    unique: true,
  })
  awardTransactionId!: string | null;

  @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true })
  paidAt!: Date | null;
}
