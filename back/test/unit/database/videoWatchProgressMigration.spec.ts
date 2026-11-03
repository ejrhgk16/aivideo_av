import { Table, type QueryRunner } from 'typeorm';
import { ReplaceWatchProgressEpisodeWithVideo20261103000000 } from '../../../src/common/database/migrations/20261103000000ReplaceWatchProgressEpisodeWithVideo.js';

type Progress = Record<string, number | boolean | string | null>;
type Video = { id: number; contentId: number; contentType: string; kind: string; displayOrder: number };

const userIndex = 'IDX_user_watch_progress_user_id_last_played_at';
const videoIndex = 'idx_user_watch_progress_video_id';
const checkName = 'CHK_user_watch_progress_position_ms';

function makeTable(key: 'episode_id' | 'video_id', includeVideoIndex = false): Table {
  return new Table({
    name: 'user_watch_progress',
    columns: [
      { name: 'user_id', type: 'int', unsigned: true, isPrimary: true },
      { name: key, type: 'int', unsigned: true, isPrimary: true },
      { name: 'position_ms', type: 'int', default: 0 },
      { name: 'is_completed', type: 'tinyint', width: 1, default: 0 },
      { name: 'last_played_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)' },
      { name: 'created_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)' },
      { name: 'updated_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)' },
    ],
    indices: [
      { name: userIndex, columnNames: ['user_id', 'last_played_at'] },
      ...(includeVideoIndex ? [{ name: videoIndex, columnNames: ['video_id'] }] : []),
    ],
    checks: [{ name: checkName, expression: 'position_ms >= 0' }],
  });
}

function setup({
  key = 'episode_id',
  rows = [] as Progress[],
  videos = [] as Video[],
  episodes = [1, 2],
  unexpectedSchema = false,
  hasPositionCheck = true,
}: {
  key?: 'episode_id' | 'video_id';
  rows?: Progress[];
  videos?: Video[];
  episodes?: number[];
  unexpectedSchema?: boolean;
  hasPositionCheck?: boolean;
} = {}) {
  const state = {
    table: makeTable(key, key === 'video_id'),
    rows: structuredClone(rows),
    videos,
    episodes,
    calls: [] as string[],
  };
  if (unexpectedSchema) state.table.columns.push({ name: 'video_id', type: 'int', unsigned: true });

  const queryRunner = {
    getTable: async () => state.table,
    query: async (sql: string) => {
      state.calls.push(sql);
      if (sql.includes('information_schema.TABLE_CONSTRAINTS')) {
        return hasPositionCheck ? [{ expression: '(position_ms >= 0)' }] : [];
      }
      if (sql.includes('LEFT JOIN episodes episode ON episode.id = progress.episode_id')) {
        const missing = state.rows.filter((row) => {
          const episodeId = Number(row.episode_id);
          return !state.episodes.includes(episodeId) || !state.videos.some(
            (video) => video.contentType === 'EPISODE' && video.contentId === episodeId && video.kind === 'FULL',
          );
        }).length;
        return [{ count: missing }];
      }
      if (sql.includes('WHERE video_id IS NULL')) {
        return [{ count: state.rows.filter((row) => row.video_id === null || row.video_id === undefined).length }];
      }
      if (sql.includes('LEFT JOIN content_videos video ON video.id = progress.video_id')) {
        const missing = state.rows.filter((row) => {
          const video = state.videos.find(({ id }) => id === Number(row.video_id));
          return !video || video.kind !== 'FULL' || video.contentType !== 'EPISODE' || !state.episodes.includes(video.contentId);
        }).length;
        return [{ count: missing }];
      }
      if (sql.includes('HAVING COUNT(*) > 1')) {
        const counts = new Map<string, number>();
        for (const row of state.rows) {
          const video = state.videos.find(({ id }) => id === Number(row.video_id));
          if (video) {
            const pair = `${row.user_id}:${video.contentId}`;
            counts.set(pair, (counts.get(pair) ?? 0) + 1);
          }
        }
        return [{ count: [...counts.values()].filter((count) => count > 1).length }];
      }
      if (sql.includes('WHERE episode_id IS NULL')) {
        return [{ count: state.rows.filter((row) => row.episode_id === null || row.episode_id === undefined).length }];
      }
      if (sql.includes('SET progress.video_id = video.id')) {
        for (const row of state.rows) {
          const episodeId = Number(row.episode_id);
          const video = state.videos
            .filter((candidate) => candidate.contentType === 'EPISODE' && candidate.contentId === episodeId && candidate.kind === 'FULL')
            .sort((left, right) => left.displayOrder - right.displayOrder)[0];
          if (video) row.video_id = video.id;
        }
        return [];
      }
      if (sql.includes('SET progress.episode_id = video.content_id')) {
        for (const row of state.rows) {
          const video = state.videos.find(({ id }) => id === Number(row.video_id));
          if (video) row.episode_id = video.contentId;
        }
        return [];
      }
      if (sql.includes('ADD COLUMN video_id')) {
        state.table.columns.splice(1, 0, { name: 'video_id', type: 'int', unsigned: true, isNullable: true });
        return [];
      }
      if (sql.includes('ADD COLUMN episode_id')) {
        state.table.columns.splice(1, 0, { name: 'episode_id', type: 'int', unsigned: true, isNullable: true });
        return [];
      }
      if (sql.includes('DROP PRIMARY KEY') && sql.includes('DROP COLUMN episode_id')) {
        for (const row of state.rows) delete row.episode_id;
        state.table.columns = state.table.columns.filter(({ name }) => name !== 'episode_id');
        state.table.columns.find(({ name }) => name === 'video_id')!.isNullable = false;
        state.table.columns.filter(({ name }) => name === 'user_id' || name === 'video_id').forEach((column) => { column.isPrimary = true; });
        state.table.indices.push({ name: videoIndex, columnNames: ['video_id'] });
        return [];
      }
      if (sql.includes('DROP PRIMARY KEY') && sql.includes('DROP COLUMN video_id')) {
        for (const row of state.rows) delete row.video_id;
        state.table.columns = state.table.columns.filter(({ name }) => name !== 'video_id');
        state.table.columns.find(({ name }) => name === 'episode_id')!.isNullable = false;
        state.table.columns.filter(({ name }) => name === 'user_id' || name === 'episode_id').forEach((column) => { column.isPrimary = true; });
        state.table.indices = state.table.indices.filter(({ name }) => name !== videoIndex);
        return [];
      }
      throw new Error(`Unexpected migration SQL: ${sql}`);
    },
  } as unknown as QueryRunner;
  return { queryRunner, state };
}

const fullVideos: Video[] = [
  { id: 21, contentId: 1, contentType: 'EPISODE', kind: 'FULL', displayOrder: 2 },
  { id: 20, contentId: 1, contentType: 'EPISODE', kind: 'FULL', displayOrder: 1 },
  { id: 22, contentId: 2, contentType: 'EPISODE', kind: 'FULL', displayOrder: 1 },
];

const progress: Progress = {
  user_id: 7,
  episode_id: 1,
  position_ms: 12345,
  is_completed: true,
  last_played_at: '2026-10-01T01:02:03.123Z',
  created_at: '2026-09-01T01:02:03.123Z',
  updated_at: '2026-10-01T01:02:03.123Z',
};

describe('ReplaceWatchProgressEpisodeWithVideo migration', () => {
  it('maps to the lowest display_order FULL video and preserves progress and timestamps', async () => {
    const original = { ...progress };
    const { queryRunner, state } = setup({ rows: [progress], videos: fullVideos });
    await new ReplaceWatchProgressEpisodeWithVideo20261103000000().up(queryRunner);

    const { episode_id: _episodeId, ...expected } = original;
    expect(state.rows).toEqual([{ ...expected, video_id: 20 }]);
    expect(state.table.primaryColumns.map(({ name }) => name)).toEqual(['user_id', 'video_id']);
    expect(state.table.indices.map(({ name }) => name)).toEqual([userIndex, videoIndex]);
    expect(state.table.checks).toMatchObject([{ name: checkName, expression: 'position_ms >= 0' }]);
    expect(state.calls.findIndex((sql) => sql.includes('LEFT JOIN episodes')))
      .toBeLessThan(state.calls.findIndex((sql) => sql.includes('ADD COLUMN video_id')));
  });

  it('keeps an empty table valid and converts its key', async () => {
    const { queryRunner, state } = setup({ videos: fullVideos });
    await new ReplaceWatchProgressEpisodeWithVideo20261103000000().up(queryRunner);
    expect(state.rows).toEqual([]);
    expect(state.table.primaryColumns.map(({ name }) => name)).toEqual(['user_id', 'video_id']);
  });

  it('rejects unexpected schema and unmapped rows before changing the schema', async () => {
    const migration = new ReplaceWatchProgressEpisodeWithVideo20261103000000();
    const unexpected = setup({ unexpectedSchema: true, videos: fullVideos });
    await expect(migration.up(unexpected.queryRunner)).rejects.toThrow('Unexpected user_watch_progress schema');
    expect(unexpected.state.calls).toEqual([]);

    const unmapped = setup({ rows: [progress], videos: [] });
    await expect(migration.up(unmapped.queryRunner)).rejects.toThrow('Cannot map every watch-progress row');
    expect(unmapped.state.calls.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);
    expect(unmapped.state.table.primaryColumns.map(({ name }) => name)).toEqual(['user_id', 'episode_id']);
    expect(unmapped.state.rows).toEqual([progress]);

    const missingPositionCheck = setup({ videos: fullVideos, hasPositionCheck: false });
    await expect(migration.up(missingPositionCheck.queryRunner)).rejects.toThrow('Expected CHK_user_watch_progress_position_ms');
    expect(missingPositionCheck.state.calls.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);

    const missingEpisode = setup({ rows: [{ ...progress, episode_id: 99 }], videos: fullVideos, episodes: [1] });
    await expect(migration.up(missingEpisode.queryRunner)).rejects.toThrow('Cannot map every watch-progress row');
    expect(missingEpisode.state.calls.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);
  });

  it('restores a safely reversible video record without changing its other values', async () => {
    const { episode_id: _episodeId, ...videoRow } = progress;
    videoRow.video_id = 20;
    const { queryRunner, state } = setup({ key: 'video_id', rows: [videoRow], videos: fullVideos });
    await new ReplaceWatchProgressEpisodeWithVideo20261103000000().down(queryRunner);

    const { video_id: _videoId, ...expected } = videoRow;
    expect(state.rows).toEqual([{ ...expected, episode_id: 1 }]);
    expect(state.table.primaryColumns.map(({ name }) => name)).toEqual(['user_id', 'episode_id']);
    expect(state.table.indices.map(({ name }) => name)).toEqual([userIndex]);
  });

  it('rejects previews, missing video or episode references, and multiple rows before down DDL', async () => {
    const migration = new ReplaceWatchProgressEpisodeWithVideo20261103000000();
    const previewVideo = { id: 30, contentId: 1, contentType: 'DRAMA', kind: 'PREVIEW', displayOrder: 1 };
    const preview = setup({
      key: 'video_id',
      rows: [{ user_id: 7, video_id: 30, position_ms: 1 }],
      videos: [...fullVideos, previewVideo],
    });
    await expect(migration.down(preview.queryRunner)).rejects.toThrow('missing or non-EPISODE FULL video');
    expect(preview.state.calls.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);

    const missingVideo = setup({
      key: 'video_id',
      rows: [{ user_id: 7, video_id: 999, position_ms: 1 }],
      videos: fullVideos,
    });
    await expect(migration.down(missingVideo.queryRunner)).rejects.toThrow('missing or non-EPISODE FULL video');
    expect(missingVideo.state.calls.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);

    const missingEpisode = setup({
      key: 'video_id',
      rows: [{ user_id: 7, video_id: 30, position_ms: 1 }],
      videos: [...fullVideos, { id: 30, contentId: 99, contentType: 'EPISODE', kind: 'FULL', displayOrder: 1 }],
      episodes: [1, 2],
    });
    await expect(migration.down(missingEpisode.queryRunner)).rejects.toThrow('missing or non-EPISODE FULL video');
    expect(missingEpisode.state.calls.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);

    const duplicate = setup({
      key: 'video_id',
      rows: [
        { user_id: 7, video_id: 20, position_ms: 1 },
        { user_id: 7, video_id: 21, position_ms: 2 },
      ],
      videos: fullVideos,
    });
    await expect(migration.down(duplicate.queryRunner)).rejects.toThrow('multiple video records');
    expect(duplicate.state.calls.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);
  });
});
