import { describe, expect, it, vi } from 'vitest';
import { createFixtureContext } from '../../api/fixtureContext.mjs';

describe('API fixture context', () => {
  it('creates users under a run-specific UUID and deletes only owned state in FK order', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{ insertId: 41 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValue([[]]);
    const context = createFixtureContext({ db: { execute }, suite: 'identity', baseUrl: 'http://localhost:3000', runId: 'run-a' });
    const user = await context.createUser();
    expect(user.loginId).toBe('api-test-run-a-1');
    expect(context.ownedUserUuids).toEqual([user.uuid]);
    expect(context.ownedUserIds).toEqual([41]);
    await context.cleanup();
    expect(execute.mock.calls.slice(3).map(([sql]) => String(sql).replace(/\s+/g, ' ').trim())).toEqual([
      'DELETE child FROM refresh_tokens child JOIN auth_sessions parent ON parent.id = child.auth_session_id WHERE parent.user_id = ?',
      'DELETE FROM auth_sessions WHERE user_id = ?',
      'DELETE FROM episode_entitlements WHERE user_id = ?',
      'DELETE FROM user_saved_videos WHERE user_id = ?',
      'DELETE FROM user_watch_progress WHERE user_id = ?',
      'DELETE FROM point_transactions WHERE wallet_user_id = ?',
      'DELETE FROM wallets WHERE user_id = ?',
      'DELETE FROM users WHERE id = ?',
    ]);
    await context.cleanup();
    expect(execute).toHaveBeenCalledTimes(11);
  });

  it('retains the pre-recorded UUID and propagates partial setup failure', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{ insertId: 42 }])
      .mockRejectedValueOnce(new Error('wallet insert failed'))
      .mockResolvedValue([[]]);
    const context = createFixtureContext({ db: { execute }, suite: 'content', baseUrl: 'http://localhost:3000' });
    await expect(context.createUser()).rejects.toThrow('wallet insert failed');
    expect(context.ownedUserUuids).toHaveLength(1);
    expect(context.ownedUserIds).toHaveLength(1);
    await context.cleanup();
    expect(execute).toHaveBeenCalledTimes(11);
  });

  it('attempts all owned progress cleanup and retries after a partial failure', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error('first delete failed'))
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[]]);
    const context = createFixtureContext({ db: { execute }, suite: 'watch-progress', baseUrl: 'http://localhost:3000' });
    await context.trackProgressPair(41, 51);
    await context.trackProgressPair(42, 52);
    const cleanup = context.cleanup();
    await expect(cleanup).rejects.toMatchObject({ name: 'AggregateError' });
    expect(execute.mock.calls.some(([sql]) => String(sql).includes('video_id = ?'))).toBe(true);
    expect(execute.mock.calls.filter(([sql]) => String(sql).startsWith('DELETE FROM user_watch_progress'))).toHaveLength(2);
    await context.cleanup();
    expect(execute.mock.calls.filter(([sql]) => String(sql).startsWith('DELETE FROM user_watch_progress'))).toHaveLength(4);
  });
});
