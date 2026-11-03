import { randomUUID } from 'node:crypto';

const USER_STATE_TABLES = [
  ['refresh_tokens', 'auth_session_id', 'auth_sessions'],
  ['auth_sessions', 'user_id'],
  ['episode_entitlements', 'user_id'],
  ['user_saved_videos', 'user_id'],
  ['user_watch_progress', 'user_id'],
  ['point_transactions', 'wallet_user_id'],
  ['wallets', 'user_id'],
];

export function createFixtureContext({ db, suite, baseUrl, runId = randomUUID() }) {
  const ownedUserUuids = [];
  const ownedUserIds = [];
  const userUuids = [];
  const progressPairs = [];
  let cleaned = false;
  let progressCleaned = false;

  return {
    runId,
    suite,
    baseUrl,
    userUuids,
    ownedUserUuids,
    ownedUserIds,
    progressPairs,
    async createUser({ accountType = 'MEMBER', balance = 0 } = {}) {
      const uuid = randomUUID();
      const loginId = `api-test-${runId}-${userUuids.length + 1}`;
      const password = randomUUID();
      ownedUserUuids.push(uuid);
      const [result] = await db.execute(
        `INSERT INTO users (uuid, login_id, password, account_type, status, display_name, production_company_id)
         VALUES (?, ?, ?, ?, 'ACTIVE', 'API test', NULL)`,
        [uuid, loginId, password, accountType],
      );
      const userId = result.insertId;
      ownedUserIds.push(userId);
      userUuids.push(uuid);
      await db.execute('INSERT INTO wallets (user_id, available_points) VALUES (?, ?)', [userId, balance]);
      return { id: userId, uuid, loginId, login_id: loginId, password };
    },
    async grantEpisode(userId, episodeId) {
      await db.execute(
        `INSERT INTO episode_entitlements (uuid, user_id, episode_id, acquisition_type, unlock_transaction_id, granted_at)
         VALUES (?, ?, ?, 'ADMIN_GRANT', NULL, UTC_TIMESTAMP(3))`,
        [randomUUID(), userId, episodeId],
      );
    },
    async trackProgressPair(userId, videoId) {
      const pair = [userId, videoId];
      const [rows] = await db.execute(
        'SELECT user_id FROM user_watch_progress WHERE user_id = ? AND video_id = ?', pair,
      );
      if (rows.length) throw new Error('Watch-progress fixture already exists before this run.');
      progressPairs.push(pair);
    },
    async cleanupProgress() {
      if (progressCleaned) return;
      const errors = [];
      for (const pair of progressPairs) {
        try {
          await db.execute('DELETE FROM user_watch_progress WHERE user_id = ? AND video_id = ?', pair);
          const [rows] = await db.execute(
            'SELECT user_id FROM user_watch_progress WHERE user_id = ? AND video_id = ?', pair,
          );
          if (rows.length) throw new Error('Run-owned watch-progress fixture remains after cleanup.');
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Could not clean every owned watch-progress fixture.');
      progressCleaned = true;
    },
    async cleanup() {
      if (cleaned) return;
      const errors = [];
      try {
        await this.cleanupProgress();
      } catch (error) {
        errors.push(error);
      }
      for (const uuid of [...ownedUserUuids].reverse()) {
        try {
          const [rows] = await db.execute('SELECT id FROM users WHERE uuid = ?', [uuid]);
          const userId = rows[0]?.id ?? ownedUserIds[ownedUserUuids.indexOf(uuid)];
          if (userId === undefined) continue;
          for (const [table, foreignKey, parentTable] of USER_STATE_TABLES) {
            try {
              if (parentTable) {
                await db.execute(
                  `DELETE child FROM ${table} child JOIN ${parentTable} parent ON parent.id = child.${foreignKey} WHERE parent.user_id = ?`,
                  [userId],
                );
              } else {
                await db.execute(`DELETE FROM ${table} WHERE ${foreignKey} = ?`, [userId]);
              }
            } catch (error) {
              errors.push(error);
            }
          }
          try {
            await db.execute('DELETE FROM users WHERE id = ?', [userId]);
          } catch (error) {
            errors.push(error);
          }
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Could not clean every owned API user fixture.');
      cleaned = true;
    },
  };
}
