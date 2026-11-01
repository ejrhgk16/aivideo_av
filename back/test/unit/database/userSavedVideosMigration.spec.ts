import { Table, type QueryRunner } from 'typeorm';
import { ReplaceUserSavedDramasWithVideos20261101000000 } from '../../../src/common/database/migrations/20261101000000ReplaceUserSavedDramasWithVideos.js';

function setup({ oldExists = true, newExists = false, savedCount = 0, failCreate = false } = {}) {
  const calls: string[] = [];
  const tables: Table[] = [];
  const queryRunner = {
    hasTable: async (name: string) => name === 'user_saved_dramas' ? oldExists : newExists,
    createTable: async (value: Table) => {
      calls.push(`create:${value.name}`);
      tables.push(value);
      if (failCreate) throw new Error('create failed');
    },
    query: async (sql: string) => { calls.push(sql); return []; },
    manager: {
      createQueryBuilder: () => ({
        from: (_table: string, _alias: string) => ({ getCount: async () => savedCount }),
      }),
    },
    dropTable: async (name: string) => { calls.push(`drop:${name}`); },
  } as unknown as QueryRunner;
  return { calls, queryRunner, tables };
}

describe('ReplaceUserSavedDramasWithVideos migration', () => {
  it('creates the video table and its CHECK before dropping old saved rows', async () => {
    const { calls, queryRunner, tables } = setup();
    await new ReplaceUserSavedDramasWithVideos20261101000000().up(queryRunner);

    expect(calls[0]).toBe('create:user_saved_videos');
    expect(tables[0].columns.map(({ name }) => name)).toEqual(['user_id', 'video_id', 'content_type', 'saved_at']);
    expect(tables[0].columns.filter(({ isPrimary }) => isPrimary).map(({ name }) => name)).toEqual(['user_id', 'video_id']);
    expect(tables[0].columns[0]).toMatchObject({ type: 'int', unsigned: true });
    expect(tables[0].columns[1]).toMatchObject({ type: 'int', unsigned: true });
    expect(tables[0].columns[2]).toMatchObject({ type: 'varchar', length: '16', isNullable: false });
    expect(tables[0].indices[0].columnNames).toEqual(['user_id', 'saved_at']);
    expect(calls.some((call) => call.includes('CHECK (content_type IN'))).toBe(true);
    expect(calls.at(-1)).toBe('drop:user_saved_dramas');
  });

  it('does not change an unexpected initial schema', async () => {
    const { calls, queryRunner } = setup({ oldExists: false });
    await expect(new ReplaceUserSavedDramasWithVideos20261101000000().up(queryRunner)).rejects.toThrow('Expected user_saved_dramas only');
    expect(calls).toEqual([]);
  });

  it('does not change a schema where synchronize already created the new table', async () => {
    const { calls, queryRunner } = setup({ oldExists: true, newExists: true });
    await expect(new ReplaceUserSavedDramasWithVideos20261101000000().up(queryRunner)).rejects.toThrow('Expected user_saved_dramas only');
    expect(calls).toEqual([]);
  });

  it('keeps the old table when creating the new table fails', async () => {
    const { calls, queryRunner } = setup({ failCreate: true });
    await expect(new ReplaceUserSavedDramasWithVideos20261101000000().up(queryRunner)).rejects.toThrow('create failed');
    expect(calls).toEqual(['create:user_saved_videos']);
  });

  it('restores the empty old schema on rollback', async () => {
    const { calls, queryRunner } = setup({ oldExists: false, newExists: true });
    await new ReplaceUserSavedDramasWithVideos20261101000000().down(queryRunner);
    expect(calls).toEqual([
      'create:user_saved_dramas',
      expect.stringContaining('ALTER TABLE `user_saved_dramas`'),
      'drop:user_saved_videos',
    ]);
  });

  it('preserves saved videos if rollback would discard them', async () => {
    const { calls, queryRunner } = setup({ oldExists: false, newExists: true, savedCount: 1 });
    await expect(new ReplaceUserSavedDramasWithVideos20261101000000().down(queryRunner)).rejects.toThrow('while saved videos exist');
    expect(calls).toEqual([]);
  });

  it('does not change an unexpected rollback schema', async () => {
    const { calls, queryRunner } = setup({ oldExists: true, newExists: true });
    await expect(new ReplaceUserSavedDramasWithVideos20261101000000().down(queryRunner)).rejects.toThrow('Expected user_saved_videos only');
    expect(calls).toEqual([]);
  });
});
