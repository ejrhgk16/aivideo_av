import { describe, expect, it, vi } from 'vitest';
import { createDramaPaginationFixtures } from '../../api/dramaPaginationFixtures.mjs';

function database() {
  let nextDramaId = 10;
  let nextVideoId = 500;
  const calls: Array<[string, unknown[]]> = [];
  return {
    calls,
    execute: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push([sql, params]);
      if (sql.includes('SELECT production_company_id')) return [[{ production_company_id: 7 }], []];
      if (sql === 'SELECT id FROM genres ORDER BY id') return [[{ id: 1 }], []];
      if (sql.includes('INSERT INTO dramas')) return [{ affectedRows: 1, insertId: nextDramaId++ }, []];
      if (sql.includes('ORDER BY published_at DESC, id DESC')) return [params.slice().reverse().map(uuid => ({ uuid })), []];
      if (sql === 'SELECT id FROM dramas WHERE uuid = ?') return [[{ id: nextDramaId - 1 }], []];
      if (sql.startsWith('SELECT uuid FROM')) return [[], []];
      if (sql.startsWith('SELECT drama_id FROM drama_genres')) return [[], []];
      if (sql.includes('INSERT INTO content_videos')) return [{ affectedRows: 1, insertId: nextVideoId++ }, []];
      if (sql.includes('SELECT id FROM dramas WHERE uuid = ?')) return [[{ id: 10 }], []];
      return [{ affectedRows: 1 }, []];
    }),
  };
}

describe('drama pagination fixture ownership', () => {
  it('creates isolated 31-row paging data and only deletes its owned records', async () => {
    const db = database();
    const fixture = createDramaPaginationFixtures({ db, runId: '12345678-abcd' });
    const values = await fixture.prepare();
    expect(JSON.parse(values.catalogExpectedUuids)).toHaveLength(31);
    expect(JSON.parse(values.catalogThirtyExpectedUuids)).toHaveLength(30);
    expect(JSON.parse(values.catalogExcludedUuids)).toHaveLength(3);
    expect(values.catalogLiteralQuery).toContain('literal%_!');
    expect(JSON.parse(values.catalogExpectedUuids)[0]).not.toBe(JSON.parse(values.catalogExpectedUuids)[30]);
    await fixture.cleanup();
    await fixture.cleanup();
    expect(db.calls.filter(([sql]) => sql.startsWith('DELETE FROM dramas'))).toHaveLength(34);
    expect(db.calls.filter(([sql]) => sql.startsWith('DELETE FROM genres'))).toHaveLength(2);
    expect(db.calls.some(([sql]) => sql.includes('DELETE FROM dramas WHERE id'))).toBe(false);
  });

  it('attempts the remaining cleanup after an owned row delete fails', async () => {
    const db = database();
    let failed = false;
    let dramaInserts = 0;
    db.execute.mockImplementation(async (sql: string, params: unknown[] = []) => {
      db.calls.push([sql, params]);
      if (sql.includes('SELECT production_company_id')) return [[{ production_company_id: 7 }], []];
      if (sql === 'SELECT id FROM genres ORDER BY id') return [[{ id: 1 }], []];
      if (sql.includes('INSERT INTO dramas')) {
        dramaInserts += 1;
        if (dramaInserts === 2) throw new Error('insert failed');
        return [{ affectedRows: 1 }, []];
      }
      if (sql === 'SELECT id FROM dramas WHERE uuid = ?') return [[{ id: 20 }], []];
      if (sql.startsWith('SELECT uuid FROM')) return [[], []];
      if (sql.startsWith('SELECT drama_id FROM drama_genres')) return [[], []];
      if (sql.startsWith('DELETE FROM dramas') && !failed) { failed = true; throw new Error('delete failed'); }
      return [{ affectedRows: 1 }, []];
    });
    const fixture = createDramaPaginationFixtures({ db, runId: 'failure-case' });
    await expect(fixture.prepare()).rejects.toThrow();
    await expect(fixture.cleanup()).rejects.toThrow('Could not clean every owned drama-pagination fixture');
    expect(db.calls.some(([sql]) => sql.startsWith('DELETE FROM genres'))).toBe(true);
    await expect(fixture.cleanup()).resolves.toBeUndefined();
    expect(db.calls.filter(([sql]) => sql.startsWith('DELETE FROM dramas')).every(([sql]) => sql.includes('WHERE uuid = ?'))).toBe(true);
  });
});
