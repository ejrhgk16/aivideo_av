import { Table, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddAuthSessions20261028000000 implements MigrationInterface {
  name = 'AddAuthSessions20261028000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'auth_sessions',
        columns: [
          { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'user_id', type: 'int', unsigned: true, isNullable: false },
          { name: 'revoked_at', type: 'datetime', precision: 3, isNullable: true },
          { name: 'created_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)', isNullable: false },
          { name: 'updated_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)', isNullable: false },
        ],
      }),
    );
    await queryRunner.createIndex(
      'auth_sessions',
      new TableIndex({ name: 'idx_auth_sessions_user_id', columnNames: ['user_id'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'auth_session_id', type: 'int', unsigned: true, isNullable: false },
          { name: 'token_hash', type: 'char', length: '64', isUnique: true, isNullable: false },
          { name: 'expires_at', type: 'datetime', precision: 3, isNullable: false },
          { name: 'used_at', type: 'datetime', precision: 3, isNullable: true },
          { name: 'created_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)', isNullable: false },
          { name: 'updated_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)', isNullable: false },
        ],
      }),
    );
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({ name: 'idx_refresh_tokens_auth_session_id', columnNames: ['auth_session_id'] }),
    );
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({ name: 'idx_refresh_tokens_expires_at', columnNames: ['expires_at'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('refresh_tokens', true);
    await queryRunner.dropTable('auth_sessions', true);
  }
}
