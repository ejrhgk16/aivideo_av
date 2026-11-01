import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { createConnection } from 'mysql2/promise';

// npm test and Harness finish use the same environment and fixture lifecycle.
for (const file of [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

function runPostman(args) {
  // The Windows npm shim is a .cmd file; launch its JS entry without a shell.
  const entry = process.platform === 'win32'
    ? process.env.PATH.split(delimiter).map(path => join(path, 'node_modules/postman-cli/bin/postman.js')).find(existsSync)
    : undefined;
  if (process.platform === 'win32' && !entry) throw new Error('Postman CLI is not installed on PATH.');
  return new Promise((resolve, reject) => {
    const child = spawn(entry ? process.execPath : 'postman', [...(entry ? [entry] : []), 'collection', 'run',
      'test/api/public.postman_collection.json', '--timeout-request', '10000',
      '--timeout-script', '5000', '--no-report-events', ...args], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
}

async function main() {
  // An explicitly supplied environment supports preconfigured development fixtures.
  if (process.env.API_TEST_ENVIRONMENT_FILE) {
    return runPostman(['--environment', process.env.API_TEST_ENVIRONMENT_FILE, ...process.argv.slice(2)]);
  }
  if ((process.env.NODE_ENV ?? 'development') !== 'development' || process.argv.length > 2) {
    throw new Error('Set API_TEST_ENVIRONMENT_FILE for non-default API test fixtures or CLI overrides.');
  }
  const baseUrl = 'http://localhost:3000';
  const root = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!root?.ok) throw new Error('API unavailable. Run: npm --prefix back run start:dev');

  for (const key of ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']) {
    if (process.env[key] === undefined || process.env[key] === '') {
      throw new Error(`Required environment variable is missing: ${key}`);
    }
  }
  const db = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: 'Z',
  });
  const entitledUuid = '00000010-0000-4000-8000-000000000001';
  const unentitledUuid = '00000012-0000-4000-8000-000000000001';
  const paidEpisodeUuid = '00000004-0000-4000-8000-000000000002';
  let temporaryLogin;
  let directory;
  let ownedPairs = [];
  let savedVideoFixture;
  let ownedSavedPairs = [];
  let prepRefreshTokens = [];
  let exitCode;
  let cleanupError;
  try {
    const [users] = await db.execute(
      'SELECT id, uuid, login_id, password FROM users WHERE uuid IN (?, ?) AND status = ?',
      [entitledUuid, unentitledUuid, 'ACTIVE'],
    );
    const entitled = users.find(user => user.uuid === entitledUuid);
    const unentitled = users.find(user => user.uuid === unentitledUuid);
    if (!entitled?.login_id || !entitled.password || !unentitled) {
      throw new Error('Required API login fixtures are missing. See test/api/README.md.');
    }
    const catalog = await fetch(`${baseUrl}/dramas`, { signal: AbortSignal.timeout(10000) }).then(r => r.json());
    const selected = catalog.find(drama => drama.previewVideos.length > 0 &&
      drama.freeEpisodeCount > 0 && drama.episodeCount > drama.freeEpisodeCount);
    if (!selected) throw new Error('Public API content fixtures are missing.');
    const detail = await fetch(`${baseUrl}/dramas/${selected.uuid}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json());
    const free = detail.episodes.find(episode => episode.pricePoints === 0);
    if (!free) throw new Error('Free episode fixture is missing.');
    const [episodes] = await db.execute('SELECT id, uuid FROM episodes WHERE uuid IN (?, ?)',
      [free.uuid, paidEpisodeUuid]);
    const freeEpisode = episodes.find(episode => episode.uuid === free.uuid);
    const paidEpisode = episodes.find(episode => episode.uuid === paidEpisodeUuid);
    if (!freeEpisode || !paidEpisode) throw new Error('Watch-progress episode fixtures are missing.');
    const [savedRows] = await db.execute(
      'SELECT video_id FROM user_saved_videos WHERE user_id = ?', [unentitled.id],
    );
    if (savedRows.length) throw new Error('Saved-video write fixture already contains saved rows. Inspect test/api/README.md.');
    const [dramas] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [selected.uuid]);
    const [orders] = await db.execute(
      "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM content_videos WHERE content_type = 'DRAMA' AND content_id = ? AND kind = 'PREVIEW'",
      [dramas[0].id],
    );
    const [paidOrders] = await db.execute(
      "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM content_videos WHERE content_type = 'EPISODE' AND content_id = ? AND kind = 'FULL'",
      [paidEpisode.id],
    );
    if (orders[0].max_order + 64 > 32767 || paidOrders[0].max_order >= 32767) throw new Error('Saved-video media fixtures are unavailable.');
    const previewVideos = Array.from({ length: 30 }, () => ({ uuid: randomUUID(), displayOrder: null }));
    for (let index = 0; index < previewVideos.length; index += 1) {
      previewVideos[index].displayOrder = orders[0].max_order + index + 1;
    }
    const otherUserVideo = { uuid: randomUUID(), displayOrder: orders[0].max_order + 31 };
    const otherUserBaselineVideos = Array.from({ length: 31 }, (_, index) => ({ uuid: randomUUID(), displayOrder: orders[0].max_order + index + 32 }));
    const tieVideos = Array.from({ length: 2 }, (_, index) => ({ uuid: randomUUID(), displayOrder: orders[0].max_order + index + 63 }));
    const paidVideo = { uuid: randomUUID(), episodeId: paidEpisode.id, displayOrder: paidOrders[0].max_order + 1 };
    const stateFixtures = { dramas: [], episodes: [], videos: [] };
    savedVideoFixture = { dramaId: dramas[0].id, previewVideos, otherUserVideo, otherUserBaselineVideos, tieVideos, paidVideo, stateFixtures };
    const trackSavedPairs = async videoUuid => {
      const [videos] = await db.execute('SELECT id FROM content_videos WHERE uuid = ?', [videoUuid]);
      if (!videos[0]) throw new Error('Saved-video fixture row could not be confirmed.');
      const [existing] = await db.execute(
        'SELECT user_id FROM user_saved_videos WHERE video_id = ? AND user_id IN (?, ?)',
        [videos[0].id, entitled.id, unentitled.id],
      );
      if (existing.length) throw new Error('Generated saved-video key already exists. Inspect test data.');
      ownedSavedPairs.push([entitled.id, videoUuid], [unentitled.id, videoUuid]);
    };
    for (const video of previewVideos) {
      await db.execute(
        `INSERT INTO content_videos
          (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
         VALUES (?, 'DRAMA', ?, 'PREVIEW', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [video.uuid, dramas[0].id, `api-test/${video.uuid}.mp4`, video.displayOrder],
      );
      await trackSavedPairs(video.uuid);
    }
    await db.execute(
      `INSERT INTO content_videos
        (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
       VALUES (?, 'DRAMA', ?, 'PREVIEW', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [otherUserVideo.uuid, dramas[0].id, `api-test/${otherUserVideo.uuid}.mp4`, otherUserVideo.displayOrder],
    );
    await trackSavedPairs(otherUserVideo.uuid);
    for (const video of otherUserBaselineVideos) {
      await db.execute(
        `INSERT INTO content_videos
          (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
         VALUES (?, 'DRAMA', ?, 'PREVIEW', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [video.uuid, dramas[0].id, `api-test/${video.uuid}.mp4`, video.displayOrder],
      );
      await trackSavedPairs(video.uuid);
    }
    for (const video of tieVideos) {
      await db.execute(
        `INSERT INTO content_videos
          (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
         VALUES (?, 'DRAMA', ?, 'PREVIEW', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [video.uuid, dramas[0].id, `api-test/${video.uuid}.mp4`, video.displayOrder],
      );
      await trackSavedPairs(video.uuid);
    }
    await db.execute(
      `INSERT INTO content_videos
        (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
       VALUES (?, 'EPISODE', ?, 'FULL', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [paidVideo.uuid, paidEpisode.id, `api-test/${paidVideo.uuid}.mp4`, paidVideo.displayOrder],
    );
    stateFixtures.videos.push({ uuid: paidVideo.uuid });
    await trackSavedPairs(paidVideo.uuid);
    const addDrama = async (status, publishedAt) => {
      const uuid = randomUUID();
      const slug = `api-test-${uuid}`;
      const [result] = await db.execute(
        `INSERT INTO dramas (uuid, production_company_id, public_slug, title, short_description, synopsis, status, published_at, created_at, updated_at)
         SELECT ?, production_company_id, ?, 'API test fixture', 'Temporary API fixture', 'Temporary API fixture', ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
         FROM dramas WHERE id = ?`,
        [uuid, slug, status, publishedAt, dramas[0].id],
      );
      if (result.affectedRows !== 1) throw new Error('Could not create a saved-video publication fixture.');
      const [rows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [uuid]);
      stateFixtures.dramas.push({ uuid, id: rows[0].id });
      return rows[0].id;
    };
    const addVideo = async (contentType, contentId, kind, displayOrder = 1) => {
      const uuid = randomUUID();
      await db.execute(
        `INSERT INTO content_videos
          (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [uuid, contentType, contentId, kind, `api-test/${uuid}.mp4`, displayOrder],
      );
      stateFixtures.videos.push({ uuid });
      await trackSavedPairs(uuid);
      return uuid;
    };
    const parentCases = [];
    for (const [key, status, publishedAt] of [
      ['draft', 'DRAFT', null], ['scheduled', 'SCHEDULED', null],
      ['future', 'PUBLISHED', new Date(Date.now() + 86400000)], ['null', 'PUBLISHED', null],
    ]) {
      const dramaId = await addDrama(status, publishedAt);
      parentCases.push({ key, type: 'PREVIEW', uuid: await addVideo('DRAMA', dramaId, 'PREVIEW') });
      const episodeUuid = randomUUID();
      const [episodeResult] = await db.execute(
        `INSERT INTO episodes (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at, created_at, updated_at)
         VALUES (?, ?, 1, 'API test fixture', 'Temporary API fixture', 60000, 0, 'PUBLISHED', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [episodeUuid, dramaId],
      );
      if (episodeResult.affectedRows !== 1) throw new Error('Could not create a saved-video parent fixture episode.');
      const [episodeRows] = await db.execute('SELECT id FROM episodes WHERE uuid = ?', [episodeUuid]);
      stateFixtures.episodes.push({ uuid: episodeUuid, id: episodeRows[0].id });
      parentCases.push({ key: `${key}-episode`, type: 'EPISODE', uuid: await addVideo('EPISODE', episodeRows[0].id, 'FULL') });
    }
    const hiddenDramaId = await addDrama('PUBLISHED', new Date(Date.now() - 60000));
    const hiddenVideoUuid = await addVideo('DRAMA', hiddenDramaId, 'PREVIEW');
    const kindMismatchVideoUuid = await addVideo('DRAMA', dramas[0].id, 'FULL');
    const episodeCases = [];
    const episodeDramaId = await addDrama('PUBLISHED', new Date(Date.now() - 60000));
    let episodeNumber = 1;
    for (const [key, status, publishedAt] of [
      ['draft', 'DRAFT', null], ['scheduled', 'SCHEDULED', null],
      ['future', 'PUBLISHED', new Date(Date.now() + 86400000)], ['null', 'PUBLISHED', null],
    ]) {
      const uuid = randomUUID();
      const [result] = await db.execute(
        `INSERT INTO episodes (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at, created_at, updated_at)
         VALUES (?, ?, ?, 'API test fixture', 'Temporary API fixture', 60000, 0, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [uuid, episodeDramaId, episodeNumber++, status, publishedAt],
      );
      if (result.affectedRows !== 1) throw new Error('Could not create a saved-video episode fixture.');
      const [rows] = await db.execute('SELECT id FROM episodes WHERE uuid = ?', [uuid]);
      stateFixtures.episodes.push({ uuid, id: rows[0].id });
      episodeCases.push({ key, type: 'EPISODE', uuid: await addVideo('EPISODE', rows[0].id, 'FULL') });
    }
    const savedVideoUuids = [...previewVideos.map(video => video.uuid), paidVideo.uuid];
    const [savedVideoOrder] = await db.query(
      `SELECT uuid FROM content_videos WHERE uuid IN (${savedVideoUuids.map(() => '?').join(',')}) ORDER BY id DESC`,
      savedVideoUuids,
    );
    const [savedTieOrder] = await db.execute(
      'SELECT uuid FROM content_videos WHERE uuid IN (?, ?) ORDER BY id DESC',
      tieVideos.map(video => video.uuid),
    );
    const [entitlementsBefore] = await db.execute(
      'SELECT episode_id FROM episode_entitlements WHERE user_id = ? ORDER BY episode_id', [unentitled.id],
    );
    const [walletBefore] = await db.execute(
      'SELECT available_points FROM wallets WHERE user_id = ?', [unentitled.id],
    );
    const expiredPayload = Buffer.from(JSON.stringify({ sub: unentitledUuid, tokenType: 'access', iat: 1, exp: 2 })).toString('base64url');
    const expiredHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const expiredInput = `${expiredHeader}.${expiredPayload}`;
    const expiredToken = `${expiredInput}.${createHmac('sha256', process.env.JWT_ACCESS_SECRET).update(expiredInput).digest('base64url')}`;
    const pairs = [[unentitled.id, freeEpisode.id], [entitled.id, paidEpisode.id]];
    for (const pair of pairs) {
      const [rows] = await db.execute('SELECT user_id FROM user_watch_progress WHERE user_id = ? AND episode_id = ?', pair);
      if (rows.length) throw new Error('Watch-progress write fixtures already exist. Inspect them per test/api/README.md.');
    }
    // Only pairs proven absent before this run may be deleted during cleanup.
    ownedPairs = pairs;
    if (unentitled.login_id === null && unentitled.password === null) {
      const loginId = `api-test-${randomUUID()}`;
      const password = randomUUID();
      const [result] = await db.execute(
        'UPDATE users SET login_id = ?, password = ? WHERE id = ? AND login_id IS NULL AND password IS NULL',
        [loginId, password, unentitled.id],
      );
      if (result.affectedRows !== 1) throw new Error('Fixture credentials changed during setup.');
      temporaryLogin = { id: unentitled.id, loginId, password };
      unentitled.login_id = loginId;
      unentitled.password = password;
    }
    if (!unentitled.login_id || !unentitled.password) throw new Error('Unentitled login fixture is incomplete.');
    const prepLoginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: unentitled.login_id, password: unentitled.password }),
    });
    if (prepLoginResponse.status !== 200) throw new Error('Could not log in to prepare the saved-video HTTP fixture.');
    const prepLogin = await prepLoginResponse.json();
    if (prepLogin.refreshToken) prepRefreshTokens.push(prepLogin.refreshToken);
    if (prepLogin.uuid !== unentitledUuid || !prepLogin.accessToken || !prepLogin.refreshToken) {
      throw new Error('Saved-video preparation login did not match the unentitled fixture user.');
    }
    const hiddenSave = await fetch(`${baseUrl}/me/saved-videos/${hiddenVideoUuid}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${prepLogin.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'PREVIEW' }),
    });
    if (hiddenSave.status !== 204) throw new Error('Could not create the saved hidden-video fixture through HTTP.');
    await db.execute('UPDATE dramas SET status = \'HIDDEN\' WHERE id = ?', [hiddenDramaId]);
    const prepLogout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: prepLogin.refreshToken }),
    });
    if (prepLogout.status !== 204) throw new Error('Could not log out the saved-video fixture preparation session.');
    prepRefreshTokens = prepRefreshTokens.filter(token => token !== prepLogin.refreshToken);
    const entitledPrepResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: entitled.login_id, password: entitled.password }),
    });
    if (entitledPrepResponse.status !== 200) throw new Error('Could not log in to prepare the tied saved-video fixture.');
    const entitledPrep = await entitledPrepResponse.json();
    if (entitledPrep.uuid !== entitledUuid || !entitledPrep.accessToken || !entitledPrep.refreshToken) {
      throw new Error('Tied saved-video preparation login did not match the entitled fixture user.');
    }
    prepRefreshTokens.push(entitledPrep.refreshToken);
    for (const video of otherUserBaselineVideos) {
      const response = await fetch(`${baseUrl}/me/saved-videos/${video.uuid}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${entitledPrep.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'PREVIEW' }),
      });
      if (response.status !== 204) throw new Error('Could not create the entitled-user pagination baseline through HTTP.');
    }
    for (const video of tieVideos) {
      const response = await fetch(`${baseUrl}/me/saved-videos/${video.uuid}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${entitledPrep.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'PREVIEW' }),
      });
      if (response.status !== 204) throw new Error('Could not create tied saved-video rows through HTTP.');
    }
    const [tieIds] = await db.execute(
      'SELECT id FROM content_videos WHERE uuid IN (?, ?)', tieVideos.map(video => video.uuid),
    );
    const [tieUpdate] = await db.execute(
      'UPDATE user_saved_videos SET saved_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY) WHERE user_id = ? AND video_id IN (?, ?)',
      [entitled.id, ...tieIds.map(video => video.id)],
    );
    if (tieUpdate.affectedRows !== 2) throw new Error('Could not set one timestamp for tied saved-video fixtures.');
    const tieLogout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: entitledPrep.refreshToken }),
    });
    if (tieLogout.status !== 204) throw new Error('Could not log out the tied saved-video preparation session.');
    prepRefreshTokens = prepRefreshTokens.filter(token => token !== entitledPrep.refreshToken);
    directory = mkdtempSync(join(tmpdir(), 'aivideo-postman-'));
    const environmentFile = join(directory, 'environment.json');
    const values = {
      entitledLoginId: entitled.login_id, entitledPassword: entitled.password,
      unentitledLoginId: unentitled.login_id, unentitledPassword: unentitled.password,
      savedPreviewVideoUuids: JSON.stringify(previewVideos.map(video => video.uuid)),
      savedPaidVideoUuid: paidVideo.uuid,
      savedVideoIdOrder: JSON.stringify(savedVideoOrder.map(video => video.uuid)),
      savedTieVideoUuids: JSON.stringify(tieVideos.map(video => video.uuid)),
      savedTieVideoIdOrder: JSON.stringify(savedTieOrder.map(video => video.uuid)),
      savedOtherUserVideoUuid: otherUserVideo.uuid,
      savedOtherUserBaselineVideoUuids: JSON.stringify(otherUserBaselineVideos.map(video => video.uuid)),
      expiredAccessToken: expiredToken,
      savedStatusVideoCases: JSON.stringify([...parentCases, ...episodeCases, { key: 'wrong-kind', type: 'PREVIEW', uuid: kindMismatchVideoUuid }]),
      savedHiddenVideoUuid: hiddenVideoUuid,
    };
    writeFileSync(environmentFile, JSON.stringify({ name: 'Local API test', values:
      Object.entries(values).map(([key, value]) => ({ key, value, enabled: true, type: 'secret' })) }), { mode: 0o600 });
    exitCode = await runPostman(['--environment', environmentFile]);
    const [hiddenSavedRows] = await db.execute(
      `SELECT saved.user_id
       FROM user_saved_videos saved
       INNER JOIN content_videos video ON video.id = saved.video_id
       WHERE saved.user_id = ? AND video.uuid = ?`,
      [unentitled.id, hiddenVideoUuid],
    );
    if (hiddenSavedRows.length) throw new Error('DELETE did not remove the saved row for the hidden-video fixture.');
    const [entitlementsAfter] = await db.execute(
      'SELECT episode_id FROM episode_entitlements WHERE user_id = ? ORDER BY episode_id', [unentitled.id],
    );
    const [walletAfter] = await db.execute(
      'SELECT available_points FROM wallets WHERE user_id = ?', [unentitled.id],
    );
    if (JSON.stringify(entitlementsAfter.map(row => row.episode_id)) !== JSON.stringify(entitlementsBefore.map(row => row.episode_id)) ||
        JSON.stringify(walletAfter.map(row => row.available_points)) !== JSON.stringify(walletBefore.map(row => row.available_points))) {
      throw new Error('Saving videos changed the unentitled fixture wallet or entitlements.');
    }
  } finally {
    try {
      for (const pair of ownedPairs) {
        await db.execute('DELETE FROM user_watch_progress WHERE user_id = ? AND episode_id = ?', pair);
      }
      for (const [userId, videoUuid] of ownedSavedPairs) {
        await db.execute(
          'DELETE saved FROM user_saved_videos saved JOIN content_videos video ON video.id = saved.video_id WHERE saved.user_id = ? AND video.uuid = ?',
          [userId, videoUuid],
        );
      }
      if (savedVideoFixture) {
        const videoIds = [
          ...savedVideoFixture.previewVideos.map(video => video.uuid),
          savedVideoFixture.otherUserVideo.uuid,
          ...savedVideoFixture.otherUserBaselineVideos.map(video => video.uuid),
          ...savedVideoFixture.tieVideos.map(video => video.uuid),
          savedVideoFixture.paidVideo.uuid,
          ...savedVideoFixture.stateFixtures.videos.map(video => video.uuid),
        ];
        for (const videoUuid of videoIds) {
          const [videos] = await db.execute('SELECT id FROM content_videos WHERE uuid = ?', [videoUuid]);
          if (videos.length) {
            await db.execute('DELETE FROM content_videos WHERE id = ?', [videos[0].id]);
          }
        }
        for (const episode of [...savedVideoFixture.stateFixtures.episodes].reverse()) {
          await db.execute('DELETE FROM episodes WHERE id = ?', [episode.id]);
        }
        for (const drama of [...savedVideoFixture.stateFixtures.dramas].reverse()) {
          await db.execute('DELETE FROM dramas WHERE id = ?', [drama.id]);
        }
      }
    } finally {
      try {
        for (const token of prepRefreshTokens) {
          const response = await fetch(`${baseUrl}/auth/logout`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token }),
          });
          if (response.status !== 204) cleanupError = new Error('Could not log out the saved-video preparation session.');
        }
        if (temporaryLogin) {
          const [result] = await db.execute(
            'UPDATE users SET login_id = NULL, password = NULL WHERE id = ? AND login_id = ? AND password = ?',
            [temporaryLogin.id, temporaryLogin.loginId, temporaryLogin.password],
          );
          if (result.affectedRows !== 1) cleanupError = new Error('Could not restore temporary fixture credentials.');
        }
      } finally {
        try {
          await db.end();
        } finally {
          if (directory) rmSync(directory, { recursive: true, force: true });
        }
      }
    }
  }
  if (cleanupError) throw cleanupError;
  return exitCode;
}

try {
  process.exitCode = await main();
} catch (error) {
  // Do not log DB parameters, passwords, tokens, or the temporary environment.
  console.error(`API test runner failed: ${error.code ?? error.message}`);
  process.exitCode = 1;
}
