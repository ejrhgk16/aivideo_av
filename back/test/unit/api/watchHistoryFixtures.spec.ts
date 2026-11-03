import { describe, expect, it, vi } from 'vitest';
import { cleanupWatchHistoryFixtures, createWatchHistoryFixtures } from '../../api/watchHistoryFixtures.mjs';

describe('watch-history fixture ownership', () => {
  it('records a drama UUID before a failed insert and attempts its cleanup', async () => {
    const execute = vi.fn(async (sql: string) => {
      if (sql.startsWith('INSERT INTO dramas')) return [{ affectedRows: 0 }];
      if (sql.startsWith('SELECT id FROM dramas')) return [[]];
      return [{}];
    });
    const db = { execute };

    await expect(createWatchHistoryFixtures({ db, sourceDramaId: 10 })).rejects.toThrow('Could not create an owned watch-history drama.');

    const insert = execute.mock.calls.find(([sql]) => String(sql).startsWith('INSERT INTO dramas'));
    const deletion = execute.mock.calls.find(([sql]) => String(sql).startsWith('DELETE FROM dramas'));
    expect(insert?.[1]?.[0]).toEqual(deletion?.[1]?.[0]);
    expect(deletion).toBeDefined();
  });

  it('attempts remaining owned cleanup and propagates all failures', async () => {
    const execute = vi.fn(async (sql: string) => {
      if (sql.startsWith('DELETE FROM content_videos')) throw new Error('video cleanup failed');
      if (sql.startsWith('DELETE FROM content_images')) throw new Error('image cleanup failed');
      if (sql.startsWith('SELECT id FROM dramas')) return [[{ id: 41 }]];
      if (sql.startsWith('DELETE FROM dramas')) throw new Error('drama cleanup failed');
      return [[]];
    });

    await expect(cleanupWatchHistoryFixtures({ execute }, {
      dramas: ['drama-uuid'], episodes: ['episode-uuid'], videos: ['video-uuid'], images: ['image-uuid'],
    })).rejects.toMatchObject({ name: 'AggregateError', errors: expect.arrayContaining([
      expect.objectContaining({ message: 'video cleanup failed' }),
      expect.objectContaining({ message: 'image cleanup failed' }),
      expect.objectContaining({ message: 'drama cleanup failed' }),
    ]) });

    expect(execute.mock.calls.map(([sql]) => String(sql))).toEqual([
      'DELETE FROM content_videos WHERE uuid = ?',
      'DELETE FROM episodes WHERE uuid = ?',
      'DELETE FROM content_images WHERE uuid = ?',
      'SELECT id FROM dramas WHERE uuid = ?',
      'DELETE FROM drama_genres WHERE drama_id = ?',
      'DELETE FROM dramas WHERE uuid = ?',
    ]);
  });
});
