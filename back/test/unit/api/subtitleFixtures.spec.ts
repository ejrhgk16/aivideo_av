import { describe, expect, it, vi } from 'vitest';
import { createSubtitleFixtures } from '../../api/subtitleFixtures.mjs';

function database({ failInsertAt, failFirstDramaDelete = false }: { failInsertAt?: string; failFirstDramaDelete?: boolean } = {}) {
  let nextId = 100;
  let insertFailed = false;
  let deleteFailed = false;
  const calls: Array<[string, unknown[]]> = [];
  const rows: Record<string, Set<string>> = {
    dramas: new Set(['foreign-drama']), episodes: new Set(['foreign-episode']),
    content_videos: new Set(['foreign-video']), episode_subtitles: new Set(['foreign-subtitle']),
  };
  const episodeIds = new Map<string, number>();
  const db = {
    calls,
    rows,
    execute: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push([sql, params]);
      if (sql.includes('SELECT production_company_id')) return [[{ production_company_id: 7 }], []];
      if (sql === 'SELECT id FROM episodes WHERE uuid = ?') {
        const id = episodeIds.get(String(params[0]));
        return [id ? [{ id }] : [], []];
      }
      const insertTable = ['dramas', 'episodes', 'content_videos', 'episode_subtitles']
        .find(table => sql.startsWith(`INSERT INTO ${table} `));
      if (insertTable) {
        if (!insertFailed && failInsertAt === insertTable) {
          insertFailed = true;
          throw new Error(`insert failed: ${insertTable}`);
        }
        const id = nextId++;
        rows[insertTable].add(String(params[0]));
        if (insertTable === 'episodes') episodeIds.set(String(params[0]), id);
        return [{ affectedRows: 1, insertId: id }, []];
      }
      const deleteTable = ['episode_subtitles', 'content_videos', 'episodes', 'dramas']
        .find(table => sql.startsWith(`DELETE FROM ${table} WHERE uuid = ?`));
      if (deleteTable) {
        if (!deleteFailed && failFirstDramaDelete && deleteTable === 'dramas') {
          deleteFailed = true;
          throw new Error('delete failed once');
        }
        rows[deleteTable].delete(String(params[0]));
        return [{ affectedRows: 1 }, []];
      }
      const verifyTable = ['episode_subtitles', 'content_videos', 'episodes', 'dramas']
        .find(table => sql.startsWith(`SELECT uuid FROM ${table} WHERE uuid IN`));
      if (verifyTable) return [[...rows[verifyTable]].filter(uuid => params.includes(uuid)).map(uuid => ({ uuid })), []];
      return [{ affectedRows: 1 }, []];
    }),
  };
  return db;
}

function fixtureContext() {
  return { grantEpisode: vi.fn(async () => undefined) };
}

describe('subtitle API fixture ownership', () => {
  it('creates all public and excluded-language cases with FULL videos and grants only the entitled user', async () => {
    const db = database();
    const context = fixtureContext();
    const fixture = createSubtitleFixtures({ db, runId: 'subtitle-run-1' });
    const values = await fixture.prepare({
      fixtureContext: context,
      entitled: { id: 12 },
      unentitled: { id: 13 },
    } as never);

    expect(Object.keys(values).sort()).toEqual([
      'subtitleEmptyEpisodeUuid', 'subtitleEnglishOnlyEpisodeUuid', 'subtitleFreeEpisodeUuid',
      'subtitleFutureDramaEpisodeUuid', 'subtitleFutureEpisodeUuid', 'subtitleHiddenDramaEpisodeUuid',
      'subtitleHiddenEpisodeUuid', 'subtitlePaidEpisodeUuid',
    ]);
    expect(new Set(Object.values(values)).size).toBe(8);
    expect(db.calls.filter(([sql]) => sql.startsWith('INSERT INTO content_videos'))).toHaveLength(8);
    expect(db.calls.filter(([sql]) => sql.startsWith('INSERT INTO episode_subtitles'))).toHaveLength(13);
    const subtitleWrites = db.calls.filter(([sql]) => sql.startsWith('INSERT INTO episode_subtitles'));
    expect(subtitleWrites.map(([, params]) => [params[2], params[3]])
      .reduce((counts, [language, format]) => {
        counts[`${language}:${format}`] = (counts[`${language}:${format}`] ?? 0) + 1;
        return counts;
      }, {} as Record<string, number>)).toEqual({ 'en:SRT': 7, 'ko:VTT': 6 });
    const subtitlesPerEpisode = new Map<number, number>();
    for (const [, params] of subtitleWrites) {
      const episodeId = Number(params[1]);
      subtitlesPerEpisode.set(episodeId, (subtitlesPerEpisode.get(episodeId) ?? 0) + 1);
    }
    expect([...subtitlesPerEpisode.values()].sort()).toEqual([1, 2, 2, 2, 2, 2, 2]);
    expect(context.grantEpisode).toHaveBeenCalledTimes(1);
    expect(context.grantEpisode).toHaveBeenCalledWith(12, expect.any(Number));
    expect(db.calls.some(([, params]) => params.includes(13))).toBe(false);

    await fixture.cleanup();
    expect(db.rows.dramas).toEqual(new Set(['foreign-drama']));
    expect(db.rows.episodes).toEqual(new Set(['foreign-episode']));
    expect(db.rows.content_videos).toEqual(new Set(['foreign-video']));
    expect(db.rows.episode_subtitles).toEqual(new Set(['foreign-subtitle']));
    const deletes = db.calls.filter(([sql]) => sql.startsWith('DELETE FROM ')).map(([sql]) => sql);
    expect(deletes.findIndex(sql => sql.includes('episode_entitlements'))).toBeLessThan(deletes.findIndex(sql => sql.startsWith('DELETE FROM episode_subtitles')));
    expect(deletes.findIndex(sql => sql.startsWith('DELETE FROM episode_subtitles'))).toBeLessThan(deletes.findIndex(sql => sql.startsWith('DELETE FROM content_videos')));
    expect(deletes.findIndex(sql => sql.startsWith('DELETE FROM content_videos'))).toBeLessThan(deletes.findIndex(sql => sql.startsWith('DELETE FROM episodes')));
    expect(deletes.findIndex(sql => sql.startsWith('DELETE FROM episodes'))).toBeLessThan(deletes.findIndex(sql => sql.startsWith('DELETE FROM dramas')));
    const callCount = db.calls.length;
    await fixture.cleanup();
    expect(db.calls).toHaveLength(callCount);
  });

  it('cleans rows recorded before a partial insert failure', async () => {
    const db = database({ failInsertAt: 'content_videos' });
    const fixture = createSubtitleFixtures({ db, runId: 'subtitle-run-partial' });
    await expect(fixture.prepare({ fixtureContext: fixtureContext(), entitled: { id: 1 }, unentitled: { id: 2 } } as never))
      .rejects.toThrow('insert failed: content_videos');
    await expect(fixture.cleanup()).resolves.toBeUndefined();
    await expect(fixture.cleanup()).resolves.toBeUndefined();
    expect(db.rows.dramas).toEqual(new Set(['foreign-drama']));
    expect(db.rows.episodes).toEqual(new Set(['foreign-episode']));
    expect(db.rows.content_videos).toEqual(new Set(['foreign-video']));
    expect(db.rows.episode_subtitles).toEqual(new Set(['foreign-subtitle']));
  });

  it('continues after a cleanup failure and succeeds when retried', async () => {
    const db = database({ failFirstDramaDelete: true });
    const fixture = createSubtitleFixtures({ db, runId: 'subtitle-run-retry' });
    await fixture.prepare({ fixtureContext: fixtureContext(), entitled: { id: 1 }, unentitled: { id: 2 } } as never);
    await expect(fixture.cleanup()).rejects.toThrow('Could not clean every owned subtitle fixture');
    expect(db.calls.some(([sql]) => sql.startsWith('DELETE FROM episode_subtitles'))).toBe(true);
    await expect(fixture.cleanup()).resolves.toBeUndefined();
    expect(db.rows.dramas).toEqual(new Set(['foreign-drama']));
  });
});
