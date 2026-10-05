import 'reflect-metadata';
import { createDatabaseOptions } from '../../../src/common/database/databaseConfig.js';
import { aiDramaEntities } from '../../../src/common/database/entities.js';

describe('createDatabaseOptions', () => {
  it('configures MySQL, entities, migrations, and development synchronization', () => {
    const options = createDatabaseOptions({
      NODE_ENV: 'development',
      DB_DATABASE: 'unit-test-db',
      DB_SYNCHRONIZE: 'true',
    });

    expect(options).toMatchObject({
      type: 'mysql',
      database: 'unit-test-db',
      synchronize: true,
    });
    expect(options.entities).toBe(aiDramaEntities);
    expect(options.migrations).toEqual([
      expect.stringMatching(/[\\/]common[\\/]database[\\/]migrations[\\/]\*\.js$/),
    ]);
  });

  it('defaults production synchronization to false', () => {
    const options = createDatabaseOptions({ NODE_ENV: 'production' });

    expect(options.synchronize).toBe(false);
  });

  it('rejects production synchronization when explicitly enabled', () => {
    expect(() =>
      createDatabaseOptions({
        NODE_ENV: 'production',
        DB_SYNCHRONIZE: 'true',
      }),
    ).toThrow('DB_SYNCHRONIZE=true is only allowed in development');
  });
});
