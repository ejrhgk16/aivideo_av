import { randomUUID } from 'node:crypto';

async function cleanupPointHistoryFixtures(db, owned) {
  const errors = [];
  for (const uuid of [...owned.episodes].reverse()) {
    try { await db.execute('DELETE FROM episodes WHERE uuid = ?', [uuid]); } catch (error) { errors.push(error); }
  }
  for (const uuid of [...owned.dramas].reverse()) {
    try { await db.execute('DELETE FROM dramas WHERE uuid = ?', [uuid]); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'Could not clean every owned point-history content fixture.');
  for (const table of ['episodes', 'dramas']) {
    for (const uuid of owned[table]) {
      const [rows] = await db.execute(`SELECT id FROM ${table} WHERE uuid = ?`, [uuid]);
      if (rows.length) throw new Error(`Run-owned point-history ${table} fixture remains after cleanup.`);
    }
  }
}

export function createPointHistoryFixtures({ db, runId }) {
  const owned = { dramas: [], episodes: [], transactionUuids: [], entitlementUuids: [] };
  let users;
  let snapshots;
  let cleaned = false;

  const addDrama = async (sourceDramaId, { title, status, publishedAt }) => {
    const uuid = randomUUID();
    owned.dramas.push(uuid);
    const [result] = await db.execute(
      `INSERT INTO dramas
        (uuid, production_company_id, public_slug, title, short_description, synopsis, status, published_at, created_at, updated_at)
       SELECT ?, production_company_id, ?, ?, 'Temporary API fixture', 'Temporary API fixture', ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
       FROM dramas WHERE id = ?`,
      [uuid, `api-point-history-${runId}-${uuid}`, title, status, publishedAt, sourceDramaId],
    );
    if (result.affectedRows !== 1) throw new Error('Could not create an owned point-history drama.');
    const [rows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [uuid]);
    if (!rows[0]) throw new Error('Could not resolve an owned point-history drama.');
    return { uuid, id: rows[0].id };
  };

  const addEpisode = async (dramaId, number, status, publishedAt) => {
    const uuid = randomUUID();
    owned.episodes.push(uuid);
    const [result] = await db.execute(
      `INSERT INTO episodes
        (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, 'API point-history fixture', 'Temporary API fixture', 60000, 30, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [uuid, dramaId, number, status, publishedAt],
    );
    if (result.affectedRows !== 1) throw new Error('Could not create an owned point-history episode.');
    const [rows] = await db.execute('SELECT id FROM episodes WHERE uuid = ?', [uuid]);
    if (!rows[0]) throw new Error('Could not resolve an owned point-history episode.');
    return { uuid, id: rows[0].id, episodeNumber: number };
  };

  const addTransaction = async (userId, input, balance) => {
    const uuid = randomUUID();
    owned.transactionUuids.push(uuid);
    const balanceAfter = balance + input.amount;
    if (balanceAfter < 0) throw new Error('Invalid owned point-history balance.');
    const idempotencyKey = `api-point-history:${uuid}`;
    const memo = 'Private point-history fixture memo';
    const [result] = await db.execute(
      `INSERT INTO point_transactions
        (uuid, wallet_user_id, transaction_type, amount, balance_after, idempotency_key, memo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, userId, input.transactionType, input.amount, balanceAfter, idempotencyKey, memo, input.createdAt],
    );
    if (result.affectedRows !== 1) throw new Error('Owned point-history insert failed.');
    let episode = null;
    if (input.episode) {
      const entitlementUuid = randomUUID();
      owned.entitlementUuids.push(entitlementUuid);
      const [entitlement] = await db.execute(
        `INSERT INTO episode_entitlements
          (uuid, user_id, episode_id, acquisition_type, unlock_transaction_id, granted_at)
         VALUES (?, ?, ?, 'POINT_PURCHASE', ?, ?)`,
        [entitlementUuid, userId, input.episode.id, result.insertId, input.createdAt],
      );
      if (entitlement.affectedRows !== 1) throw new Error('Owned point-history entitlement insert failed.');
      if (input.publicContent) episode = { dramaTitle: input.dramaTitle, episodeNumber: input.episode.episodeNumber };
    }
    return {
      balanceAfter,
      item: { uuid, transactionType: input.transactionType, amount: input.amount, balanceAfter,
        createdAt: input.createdAt.toISOString(), episode },
    };
  };

  const createLedger = async (user, count, content) => {
    const inputs = [];
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    for (let index = 0; index < count; index += 1) {
      const tiedOffsets = [0, 4000, 1000, 3000, 2000, 5000, 0, 1000];
      const createdAt = new Date(start + (index < tiedOffsets.length ? tiedOffsets[index] : index * 1000));
      const transactionType = ['PURCHASE', 'AD_REWARD', 'EPISODE_UNLOCK', 'ADMIN_ADJUSTMENT', 'REFUND'][index % 5];
      const amount = transactionType === 'EPISODE_UNLOCK' ? -30
        : transactionType === 'ADMIN_ADJUSTMENT' && index % 10 === 3 ? -7
          : transactionType === 'REFUND' ? 30 : 100 + index;
      const input = { transactionType, amount, createdAt };
      if (transactionType === 'EPISODE_UNLOCK') {
        const cases = [
          { episode: content.visible, publicContent: true },
          { episode: content.hiddenEpisode },
          { episode: content.futureEpisode },
          { episode: content.hiddenDramaEpisode },
          { episode: content.futureDramaEpisode },
          { episode: null },
        ];
        const item = cases[Math.floor(index / 5) % cases.length];
        if (item.episode) {
          input.episode = item.episode;
          input.publicContent = item.publicContent;
          input.dramaTitle = content.visibleDramaTitle;
        }
      }
      inputs.push(input);
    }
    let balance = 10000;
    const items = [];
    for (const input of inputs) {
      const added = await addTransaction(user.id, input, balance);
      balance = added.balanceAfter;
      items.push(added.item);
    }
    await db.execute('UPDATE wallets SET available_points = ? WHERE user_id = ?', [balance, user.id]);
    const [actual] = await db.execute(
      `SELECT uuid, created_at, id FROM point_transactions WHERE wallet_user_id = ? ORDER BY created_at DESC, id DESC`,
      [user.id],
    );
    const byUuid = new Map(items.map(item => [item.uuid, item]));
    return { items: actual.map(row => byUuid.get(row.uuid)), balance };
  };

  return {
    async prepare({ fixtureContext, entitled, unentitled, sourceDramaId }) {
      users = { entitled, unentitled, boundary: await fixtureContext.createUser({ balance: 10000 }) };
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const visibleDrama = await addDrama(sourceDramaId, { title: `API point-history ${runId}`, status: 'PUBLISHED', publishedAt: new Date(now.getTime() - 86400000) });
      const hiddenDrama = await addDrama(sourceDramaId, { title: `API hidden point-history ${runId}`, status: 'HIDDEN', publishedAt: new Date(now.getTime() - 86400000) });
      const futureDrama = await addDrama(sourceDramaId, { title: `API future point-history ${runId}`, status: 'PUBLISHED', publishedAt: future });
      const visible = await addEpisode(visibleDrama.id, 1, 'PUBLISHED', new Date(now.getTime() - 86400000));
      const hiddenEpisode = await addEpisode(visibleDrama.id, 2, 'HIDDEN', new Date(now.getTime() - 86400000));
      const futureEpisode = await addEpisode(visibleDrama.id, 3, 'PUBLISHED', future);
      const hiddenDramaEpisode = await addEpisode(hiddenDrama.id, 1, 'PUBLISHED', new Date(now.getTime() - 86400000));
      const futureDramaEpisode = await addEpisode(futureDrama.id, 1, 'PUBLISHED', new Date(now.getTime() - 86400000));
      const content = { visible, hiddenEpisode, futureEpisode, hiddenDramaEpisode, futureDramaEpisode,
        visibleDramaTitle: `API point-history ${runId}` };
      const entitledRows = await createLedger(users.entitled, 31, content);
      const boundaryRows = await createLedger(users.boundary, 30, content);
      const [emptyRows] = await db.execute('SELECT id FROM point_transactions WHERE wallet_user_id = ?', [users.unentitled.id]);
      if (emptyRows.length) throw new Error('Unentitled point-history fixture must start with an empty ledger.');
      snapshots = new Map();
      for (const user of Object.values(users)) snapshots.set(user.id, await snapshotUser(db, user.id));
      const values = {
        entitledLoginId: users.entitled.loginId,
        entitledPassword: users.entitled.password,
        unentitledLoginId: users.unentitled.loginId,
        unentitledPassword: users.unentitled.password,
        entitledUserUuid: users.entitled.uuid,
        unentitledUserUuid: users.unentitled.uuid,
        pointHistoryBoundaryLoginId: users.boundary.loginId,
        pointHistoryBoundaryPassword: users.boundary.password,
        pointHistoryExpectedItems: JSON.stringify(entitledRows.items),
        pointHistoryBoundaryExpectedItems: JSON.stringify(boundaryRows.items),
      };
      return values;
    },
    async verifyUnchanged() {
      if (!snapshots) throw new Error('Point-history snapshots were not prepared.');
      for (const [userId, before] of snapshots) {
        const after = await snapshotUser(db, userId);
        if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('Point-history API changed a fixture wallet, ledger, or entitlement.');
      }
    },
    async cleanup() {
      if (cleaned) return;
      await cleanupPointHistoryFixtures(db, owned);
      cleaned = true;
    },
  };
}

async function snapshotUser(db, userId) {
  const [wallets] = await db.execute('SELECT * FROM wallets WHERE user_id = ? ORDER BY user_id', [userId]);
  const [transactions] = await db.execute('SELECT * FROM point_transactions WHERE wallet_user_id = ? ORDER BY id', [userId]);
  const [entitlements] = await db.execute('SELECT * FROM episode_entitlements WHERE user_id = ? ORDER BY id', [userId]);
  return { wallets, transactions, entitlements };
}
