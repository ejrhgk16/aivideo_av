import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'point_transactions' })
@Index('idx_point_transactions_wallet_created_at', [
  'walletUserId',
  'createdAt',
])
@Check(
  'chk_point_transactions_transaction_type',
  "transaction_type IN ('PURCHASE','AD_REWARD','EPISODE_UNLOCK','ADMIN_ADJUSTMENT','REFUND')",
)
@Check('chk_point_transactions_amount_nonzero', 'amount <> 0')
@Check('chk_point_transactions_balance_after_non_negative', 'balance_after >= 0')
export class PointTransaction {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'char', length: 36, unique: true })
  uuid!: string;

  @Column({ name: 'wallet_user_id', type: 'int', unsigned: true })
  walletUserId!: number;

  @Column({ name: 'transaction_type', type: 'varchar', length: 24 })
  transactionType!: string;

  @Column({ type: 'int' })
  amount!: number;

  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter!: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, unique: true })
  idempotencyKey!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  memo!: string | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;
}
