import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'auth_sessions' })
@Index('idx_auth_sessions_user_id', ['userId'])
export class AuthSession extends AuditedEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId!: number;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true })
  revokedAt!: Date | null;
}
