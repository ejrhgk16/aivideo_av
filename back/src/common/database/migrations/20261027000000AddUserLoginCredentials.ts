import { TableIndex, type MigrationInterface, type QueryRunner, type Table } from 'typeorm';

const indexName = 'uq_users_login_id';

function assertLoginIdIndex(index: TableIndex): void {
  if (
    !index.isUnique ||
    index.columnNames.length !== 1 ||
    index.columnNames[0] !== 'login_id'
  ) {
    throw new Error(`Existing ${indexName} does not match the expected unique login_id index.`);
  }
}

function assertCredentialColumns(table: Table): void {
  const loginId = table.findColumnByName('login_id');
  const password = table.findColumnByName('password');
  if (
    loginId &&
    (loginId.type.toLowerCase() !== 'varchar' || loginId.length !== '100' || !loginId.isNullable)
  ) {
    throw new Error('Existing users.login_id does not match VARCHAR(100) NULL.');
  }
  if (
    password &&
    (password.type.toLowerCase() !== 'varchar' || password.length !== '255' || !password.isNullable)
  ) {
    throw new Error('Existing users.password does not match VARCHAR(255) NULL.');
  }
}

export class AddUserLoginCredentials20261027000000 implements MigrationInterface {
  name = 'AddUserLoginCredentials20261027000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) throw new Error('The users table is required before adding login credentials.');
    assertCredentialColumns(table);

    if (!table.findColumnByName('login_id')) {
      await queryRunner.query('ALTER TABLE `users` ADD COLUMN `login_id` VARCHAR(100) NULL');
    }
    if (!table.findColumnByName('password')) {
      await queryRunner.query('ALTER TABLE `users` ADD COLUMN `password` VARCHAR(255) NULL');
    }

    const updatedTable = await queryRunner.getTable('users');
    if (!updatedTable) throw new Error('The users table disappeared during migration.');
    assertCredentialColumns(updatedTable);
    const existingIndex = updatedTable.indices.find(({ name }) => name === indexName);
    if (existingIndex) {
      assertLoginIdIndex(existingIndex);
    } else {
      const equivalentIndex = updatedTable.indices.find(
        (index) => index.isUnique && index.columnNames.length === 1 && index.columnNames[0] === 'login_id',
      );
      if (equivalentIndex) {
        throw new Error(`A unique login_id index exists with unexpected name ${equivalentIndex.name}.`);
      }
      await queryRunner.createIndex(
        'users',
        new TableIndex({
          name: indexName,
          columnNames: ['login_id'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) return;
    const index = table.indices.find(({ name }) => name === indexName);
    if (index) {
      assertLoginIdIndex(index);
      await queryRunner.dropIndex('users', index);
    }
    if (table.findColumnByName('password')) {
      await queryRunner.dropColumn('users', 'password');
    }
    if (table.findColumnByName('login_id')) {
      await queryRunner.dropColumn('users', 'login_id');
    }
  }
}
