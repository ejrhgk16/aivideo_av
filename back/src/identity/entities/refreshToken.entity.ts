import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { AuditedEntity } from '../../common/entities/auditedEntity.entity.js';

@Entity({ name: 'refresh_tokens' })
@Index('idx_refresh_tokens_auth_session_id', ['authSessionId'])
@Index('idx_refresh_tokens_expires_at', ['expiresAt'])
export class RefreshToken extends AuditedEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'auth_session_id', type: 'int', unsigned: true })
  authSessionId!: number;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true })
  usedAt!: Date | null;
}
