import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createConnection } from 'mysql2/promise';
import { acquireContentLock } from './contentLock.mjs';
import { createFixtureContext } from './fixtureContext.mjs';
import { parseSuiteArguments } from './suites.mjs';

const coordinatorAbort = new AbortController();
let coordinatorDisconnected = false;
process.on('message', message => {
  if (message?.type === 'abort') coordinatorAbort.abort();
});
process.on('disconnect', () => {
  coordinatorDisconnected = true;
  coordinatorAbort.abort();
});

// npm test and Harness finish use the same environment and fixture lifecycle.
for (const file of [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

function runPostman(collectionPath, args) {
  // The Windows npm shim is a .cmd file; launch its JS entry without a shell.
  const entry = process.platform === 'win32'
    ? process.env.PATH.split(delimiter).map(path => join(path, 'node_modules/postman-cli/bin/postman.js')).find(existsSync)
    : undefined;
  if (process.platform === 'win32' && !entry) throw new Error('Postman CLI is not installed on PATH.');
  return new Promise((resolve, reject) => {
    const child = spawn(entry ? process.execPath : 'postman', [...(entry ? [entry] : []), 'collection', 'run',
      String(collectionPath), '--timeout-request', '10000',
      '--timeout-script', '5000', '--no-report-events', ...args], { stdio: 'inherit', signal: coordinatorAbort.signal });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
}

function targetBaseUrl(environmentArgs, postmanArgs) {
  let baseUrl = 'http://localhost:3000';
  const environmentIndex = environmentArgs.indexOf('--environment');
  if (environmentIndex >= 0) {
    const file = JSON.parse(readFileSync(environmentArgs[environmentIndex + 1], 'utf8'));
    const value = file.values?.find(item => item.key === 'baseUrl' && item.enabled !== false)?.value;
    if (value) baseUrl = value;
  }
  for (let index = 0; index < postmanArgs.length; index += 1) {
    const argument = postmanArgs[index] === '--env-var' ? postmanArgs[index + 1]
      : postmanArgs[index].startsWith('--env-var=') ? postmanArgs[index].slice('--env-var='.length)
        : undefined;
    if (argument?.startsWith('baseUrl=')) baseUrl = argument.slice('baseUrl='.length);
  }
  return baseUrl;
}

function waitForCoordinator(expected) {
  if (!process.send) return Promise.resolve();
  if (coordinatorAbort.signal.aborted) return Promise.reject(new Error(coordinatorDisconnected
    ? 'Parallel API coordinator disconnected.' : 'Parallel API run was aborted by its coordinator.'));
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      process.off('message', onMessage);
      process.off('disconnect', onDisconnect);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for coordinator: ${expected}`)), 5 * 60_000);
    const onMessage = message => {
      if (message?.type === 'abort') return finish(new Error('Parallel API run was aborted by its coordinator.'));
      if (message?.type === expected) finish();
    };
    const onDisconnect = () => finish(new Error('Parallel API coordinator disconnected.'));
    process.on('message', onMessage);
    process.on('disconnect', onDisconnect);
  });
}

async function coordinate(type, details = {}) {
  if (!process.send) return;
  const next = type === 'prepared' ? 'start' : 'cleanup';
  const waiting = waitForCoordinator(next);
  process.send({ type, ...details });
  await waiting;
}

async function runSuitesSequentially(suites, args) {
  const runnerPath = fileURLToPath(import.meta.url);
  for (const suite of suites) {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [runnerPath, '--suite', suite.id, ...args], { stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', exitCode => resolve(exitCode ?? 1));
    });
    if (code !== 0) return code;
  }
  return 0;
}

async function main() {
  const args = process.argv.slice(2);
  const { suites, postmanArgs } = parseSuiteArguments(args);
  if (suites.length > 1 && !process.env.API_TEST_ENVIRONMENT_FILE) {
    return runSuitesSequentially(suites, postmanArgs);
  }
  async function runSuites(environmentArgs = [], lockEachSuite = true, forceExclusive = false) {
    const target = targetBaseUrl(environmentArgs, postmanArgs);
    for (const suite of suites) {
      const release = lockEachSuite
        ? await acquireContentLock(target, forceExclusive ? 'exclusive' : suite.contentMode, {
          signal: coordinatorAbort.signal,
          onWait: () => process.send?.({ type: 'lock-waiting', suite: suite.id, baseUrl: target }),
        })
        : async () => {};
      try {
        const sourcePath = fileURLToPath(new URL(`./${suite.collection}`, import.meta.url));
        const runDirectory = mkdtempSync(join(tmpdir(), 'aivideo-postman-run-'));
        try {
          const collectionPath = join(runDirectory, suite.collection);
          writeFileSync(collectionPath, readFileSync(sourcePath));
          const runEnvironmentArgs = [...environmentArgs];
          const environmentIndex = runEnvironmentArgs.indexOf('--environment');
          if (environmentIndex >= 0) {
            const environmentPath = join(runDirectory, 'environment.json');
            writeFileSync(environmentPath, readFileSync(runEnvironmentArgs[environmentIndex + 1]));
            runEnvironmentArgs[environmentIndex + 1] = environmentPath;
          }
          const code = await runPostman(collectionPath, [...runEnvironmentArgs, ...postmanArgs]);
          if (code !== 0) return code;
        } finally {
          rmSync(runDirectory, { recursive: true, force: true });
        }
      } finally {
        await release();
      }
    }
    return 0;
  }
  // An explicitly supplied environment supports preconfigured development fixtures.
  if (process.env.API_TEST_ENVIRONMENT_FILE) {
    return runSuites(['--environment', process.env.API_TEST_ENVIRONMENT_FILE], true, true);
  }
  if ((process.env.NODE_ENV ?? 'development') !== 'development' || postmanArgs.length > 0) {
    throw new Error('Set API_TEST_ENVIRONMENT_FILE for non-default API test fixtures or CLI overrides.');
  }
  const baseUrl = 'http://localhost:3000';
  const root = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!root?.ok) throw new Error('API unavailable. Run: npm --prefix back run start:dev');
  if (suites.every(suite => ['http', 'programming'].includes(suite.id))) return runSuites();

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
  const managedLockMode = suites.some(suite => suite.id === 'saved-videos') ? 'exclusive' : 'shared';
  let releaseFixtureLock;
  try {
    releaseFixtureLock = await acquireContentLock(baseUrl, managedLockMode, {
      signal: coordinatorAbort.signal,
      onWait: () => process.send?.({ type: 'lock-waiting', suite: suites.map(suite => suite.id).join(','), baseUrl }),
    });
  } catch (error) {
    await db.end();
    throw error;
  }
  let entitledUuid;
  let unentitledUuid;
  let paidEpisodeUuid;
  let lockedEpisodeUuid;
  let purchaseTestEpisodeUuid;
  const fixtureContext = createFixtureContext({ db, suite: suites.map(suite => suite.id).join(','), baseUrl });
  let entitled;
  let unentitled;
  let directory;
  let ownedPairs = [];
  let savedVideoFixture;
  let ownedSavedPairs = [];
  let ownedCollectionLinks = [];
  let prepRefreshTokens = [];
  let exitCode;
  let cleanupError;
  let operationError;
  try {
    await (async () => {
    entitled = await fixtureContext.createUser({ balance: 10000 });
    unentitled = await fixtureContext.createUser();
    entitledUuid = entitled.uuid;
    unentitledUuid = unentitled.uuid;
    if (suites.every(suite => suite.id === 'identity')) {
      directory = mkdtempSync(join(tmpdir(), 'aivideo-postman-'));
      const environmentFile = join(directory, 'environment.json');
      const values = {
        entitledLoginId: entitled.login_id, entitledPassword: entitled.password,
        unentitledLoginId: unentitled.login_id, unentitledPassword: unentitled.password,
        entitledUserUuid: entitledUuid, unentitledUserUuid: unentitledUuid,
      };
      writeFileSync(environmentFile, JSON.stringify({ name: 'Local API test', values:
        Object.entries(values).map(([key, value]) => ({ key, value, enabled: true, type: 'secret' })) }), { mode: 0o600 });
      await coordinate('prepared', { suite: ['identity'], runId: fixtureContext.runId, userUuids: fixtureContext.userUuids, progressPairs: [] });
      exitCode = await runSuites(['--environment', environmentFile], false);
      if (exitCode !== 0) throw new Error('Postman failed for the identity API suite.');
      await coordinate('verified', { suite: ['identity'], runId: fixtureContext.runId, userUuids: fixtureContext.userUuids, progressPairs: [] });
      return exitCode;
    }
    const catalog = await fetch(`${baseUrl}/dramas`, { signal: AbortSignal.timeout(10000) }).then(r => r.json());
    const selected = catalog.find(drama => drama.previewVideos.length > 0 &&
      drama.freeEpisodeCount > 0 && drama.episodeCount > drama.freeEpisodeCount);
    if (!selected) throw new Error('Public API content fixtures are missing.');
    const details = await Promise.all(catalog.map(drama =>
      fetch(`${baseUrl}/dramas/${drama.uuid}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json())));
    const detail = details.find(candidate => candidate.uuid === selected.uuid);
    const free = detail.episodes.find(episode => episode.pricePoints === 0);
    if (!free) throw new Error('Free episode fixture is missing.');
    const publicPaidEpisodes = details.flatMap(candidate => candidate.episodes
      .filter(episode => episode.pricePoints > 0).map(episode => ({ dramaUuid: candidate.uuid, ...episode })));
    const selectedPaid = publicPaidEpisodes.find(episode => episode.dramaUuid === selected.uuid);
    const lockedPaid = publicPaidEpisodes.find(episode => episode.dramaUuid === selected.uuid && episode.uuid !== selectedPaid?.uuid);
    const purchasePaid = publicPaidEpisodes.find(episode => episode.uuid !== selectedPaid?.uuid && episode.uuid !== lockedPaid?.uuid);
    if (!selectedPaid || !lockedPaid || !purchasePaid) {
      throw new Error('At least three public paid episode fixtures are required for entitlement, denial, and purchase checks.');
    }
    paidEpisodeUuid = selectedPaid.uuid;
    lockedEpisodeUuid = lockedPaid.uuid;
    purchaseTestEpisodeUuid = purchasePaid.uuid;
    const [episodes] = await db.execute('SELECT id, uuid FROM episodes WHERE uuid IN (?, ?)',
      [free.uuid, paidEpisodeUuid]);
    const freeEpisode = episodes.find(episode => episode.uuid === free.uuid);
    const paidEpisode = episodes.find(episode => episode.uuid === paidEpisodeUuid);
    if (!freeEpisode || !paidEpisode) throw new Error('Watch-progress episode fixtures are missing.');
    await fixtureContext.grantEpisode(entitled.id, paidEpisode.id);
    const pairs = [[unentitled.id, freeEpisode.id], [entitled.id, paidEpisode.id]];
    for (const pair of pairs) {
      await fixtureContext.trackProgressPair(...pair);
    }
    ownedPairs = fixtureContext.progressPairs;
    const watchProgressLastPlayedAt = new Date();
    if (suites.some(suite => suite.id === 'content')) {
      await db.execute(
        `INSERT INTO user_watch_progress (user_id, episode_id, position_ms, is_completed, last_played_at)
         VALUES (?, ?, 0, 0, ?)`,
        [entitled.id, paidEpisode.id, watchProgressLastPlayedAt],
      );
    }
    if (!suites.some(suite => suite.id === 'saved-videos')) {
      directory = mkdtempSync(join(tmpdir(), 'aivideo-postman-'));
      const environmentFile = join(directory, 'environment.json');
      const values = {
        entitledLoginId: entitled.login_id, entitledPassword: entitled.password,
        unentitledLoginId: unentitled.login_id, unentitledPassword: unentitled.password,
        entitledUserUuid: entitledUuid, unentitledUserUuid: unentitledUuid,
        entitlementDramaUuid: selected.uuid, entitledEpisodeUuid: paidEpisodeUuid,
        lockedEpisodeUuid, purchaseTestEpisodeUuid,
        pointIncreaseIdempotencyKey: `api-test:${fixtureContext.runId}:points:v1`,
        watchProgressEpisodeUuid: paidEpisodeUuid, watchProgressPositionMs: '0',
        watchProgressIsCompleted: 'false', watchProgressLastPlayedAt: watchProgressLastPlayedAt.toISOString(),
      };
      writeFileSync(environmentFile, JSON.stringify({ name: 'Local API test', values:
        Object.entries(values).map(([key, value]) => ({ key, value, enabled: true, type: 'secret' })) }), { mode: 0o600 });
      await coordinate('prepared', { suite: suites.map(suite => suite.id), runId: fixtureContext.runId,
        userUuids: fixtureContext.userUuids, progressPairs: pairs });
      exitCode = await runSuites(['--environment', environmentFile], false);
      if (exitCode !== 0) throw new Error('Postman failed for the selected API suite.');
      if (suites.some(suite => suite.id === 'watch-progress')) {
        const [rows] = await db.execute(
          'SELECT user_id, episode_id FROM user_watch_progress WHERE (user_id, episode_id) IN ((?, ?), (?, ?)) ORDER BY user_id, episode_id',
          pairs.flat(),
        );
        if (rows.length !== pairs.length) throw new Error('Watch-progress verification did not leave both expected fixture rows.');
      }
      await coordinate('verified', { suite: suites.map(suite => suite.id), runId: fixtureContext.runId,
        userUuids: fixtureContext.userUuids, progressPairs: pairs });
      return exitCode;
    }
    const [savedRows] = await db.execute(
      'SELECT video_id FROM user_saved_videos WHERE user_id = ?', [unentitled.id],
    );
    if (savedRows.length) throw new Error('Saved-video write fixture already contains saved rows. Inspect test/api/README.md.');
    const [selectedIds] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [selected.uuid]);
    const stateFixtures = { dramas: [], episodes: [], videos: [], images: [] };
    savedVideoFixture = { previewVideos: [], otherUserVideo: null, otherUserBaselineVideos: [], tieVideos: [], paidVideo: null, stateFixtures };
    const savedDramaUuid = randomUUID();
    stateFixtures.dramas.push({ uuid: savedDramaUuid });
    const [savedDramaResult] = await db.execute(
      `INSERT INTO dramas (uuid, production_company_id, public_slug, title, short_description, synopsis, status, published_at, created_at, updated_at)
       SELECT ?, production_company_id, ?, 'API saved-video fixture', 'Temporary API fixture', 'Temporary API fixture', 'PUBLISHED', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
       FROM dramas WHERE id = ?`,
      [savedDramaUuid, `api-test-${savedDramaUuid}`, selectedIds[0].id],
    );
    if (savedDramaResult.affectedRows !== 1) throw new Error('Could not create an owned public saved-video drama.');
    const [savedDramaRows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [savedDramaUuid]);
    const savedDramaId = savedDramaRows[0].id;
    stateFixtures.dramas[0].id = savedDramaId;
    await db.execute('INSERT INTO drama_genres (drama_id, genre_id) SELECT ?, genre_id FROM drama_genres WHERE drama_id = ?', [savedDramaId, selectedIds[0].id]);
    const [collectionRows] = await db.execute(
      "SELECT id FROM content_collections WHERE code = 'HOME_FEATURED' AND is_active = 1",
    );
    if (!collectionRows[0]) throw new Error('The published HOME_FEATURED collection fixture is missing.');
    const [collectionOrder] = await db.execute(
      'SELECT COALESCE(MAX(display_order), 0) AS max_order FROM collection_dramas WHERE collection_id = ?',
      [collectionRows[0].id],
    );
    await db.execute(
      'INSERT INTO collection_dramas (collection_id, drama_id, display_order) VALUES (?, ?, ?)',
      [collectionRows[0].id, savedDramaId, collectionOrder[0].max_order + 1],
    );
    ownedCollectionLinks.push([collectionRows[0].id, savedDramaId]);
    const [sourceImages] = await db.execute(
      "SELECT kind, storage_key, alt_text, display_order FROM content_images WHERE content_type = 'DRAMA' AND content_id = ?",
      [selectedIds[0].id],
    );
    for (const image of sourceImages) {
      const uuid = randomUUID();
      stateFixtures.images.push(uuid);
      await db.execute(
        `INSERT INTO content_images (uuid, content_type, content_id, kind, storage_key, alt_text, display_order, created_at, updated_at)
         VALUES (?, 'DRAMA', ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [uuid, savedDramaId, image.kind, image.storage_key, image.alt_text, image.display_order],
      );
    }
    if (!sourceImages.some(image => image.kind === 'POSTER')) throw new Error('The selected public drama has no poster to clone into saved-video fixtures.');
    const [orders] = await db.execute(
      "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM content_videos WHERE content_type = 'DRAMA' AND content_id = ? AND kind = 'PREVIEW'",
      [savedDramaId],
    );
    const savedEpisodeUuid = randomUUID();
    stateFixtures.episodes.push({ uuid: savedEpisodeUuid });
    const [savedEpisodeResult] = await db.execute(
      `INSERT INTO episodes (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at, created_at, updated_at)
       VALUES (?, ?, 1, 'API saved-video fixture episode', 'Temporary API fixture', 60000, ?, 'PUBLISHED', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [savedEpisodeUuid, savedDramaId, 0],
    );
    if (savedEpisodeResult.affectedRows !== 1) throw new Error('Could not create an owned public saved-video episode.');
    const [savedEpisodeRows] = await db.execute('SELECT id FROM episodes WHERE uuid = ?', [savedEpisodeUuid]);
    const savedEpisodeId = savedEpisodeRows[0].id;
    stateFixtures.episodes[0].id = savedEpisodeId;
    const savedPaidEpisodeUuid = randomUUID();
    stateFixtures.episodes.push({ uuid: savedPaidEpisodeUuid });
    const [paidEpisodeResult] = await db.execute(
      `INSERT INTO episodes (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at, created_at, updated_at)
       VALUES (?, ?, 2, 'API saved-video paid fixture episode', 'Temporary API fixture', 60000, ?, 'PUBLISHED', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [savedPaidEpisodeUuid, savedDramaId, Math.max(1, selectedPaid.pricePoints)],
    );
    if (paidEpisodeResult.affectedRows !== 1) throw new Error('Could not create an owned public paid saved-video episode.');
    const [paidEpisodeRows] = await db.execute('SELECT id, price_points FROM episodes WHERE uuid = ?', [savedPaidEpisodeUuid]);
    const savedPaidEpisodeId = paidEpisodeRows[0].id;
    stateFixtures.episodes[1].id = savedPaidEpisodeId;
    const [paidEntitlements] = await db.execute(
      'SELECT user_id FROM episode_entitlements WHERE episode_id = ? AND user_id IN (?, ?)',
      [savedPaidEpisodeId, entitled.id, unentitled.id],
    );
    if (paidEpisodeRows[0].price_points <= 0 || paidEntitlements.length) {
      throw new Error('The saved-video PAID FULL fixture must remain paid and unentitled.');
    }
    const [paidOrders] = await db.execute(
      "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM content_videos WHERE content_type = 'EPISODE' AND content_id = ? AND kind = 'FULL'",
      [savedPaidEpisodeId],
    );
    if (orders[0].max_order + 64 > 32767 || paidOrders[0].max_order >= 32767) throw new Error('Saved-video media fixture display-order capacity is unavailable.');
    const previewVideos = Array.from({ length: 30 }, () => ({ uuid: randomUUID(), displayOrder: null }));
    for (let index = 0; index < previewVideos.length; index += 1) {
      previewVideos[index].displayOrder = orders[0].max_order + index + 1;
    }
    const otherUserVideo = { uuid: randomUUID(), displayOrder: orders[0].max_order + 31 };
    const otherUserBaselineVideos = Array.from({ length: 31 }, (_, index) => ({ uuid: randomUUID(), displayOrder: orders[0].max_order + index + 32 }));
    const tieVideos = Array.from({ length: 2 }, (_, index) => ({ uuid: randomUUID(), displayOrder: orders[0].max_order + index + 63 }));
    const paidVideo = { uuid: randomUUID(), episodeId: savedPaidEpisodeId, displayOrder: paidOrders[0].max_order + 1 };
    Object.assign(savedVideoFixture, { dramaId: savedDramaId, previewVideos, otherUserVideo, otherUserBaselineVideos, tieVideos, paidVideo });
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
        [video.uuid, savedDramaId, `api-test/${video.uuid}.mp4`, video.displayOrder],
      );
      await trackSavedPairs(video.uuid);
    }
    await db.execute(
      `INSERT INTO content_videos
        (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
       VALUES (?, 'DRAMA', ?, 'PREVIEW', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [otherUserVideo.uuid, savedDramaId, `api-test/${otherUserVideo.uuid}.mp4`, otherUserVideo.displayOrder],
    );
    await trackSavedPairs(otherUserVideo.uuid);
    for (const video of otherUserBaselineVideos) {
      await db.execute(
        `INSERT INTO content_videos
          (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
         VALUES (?, 'DRAMA', ?, 'PREVIEW', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [video.uuid, savedDramaId, `api-test/${video.uuid}.mp4`, video.displayOrder],
      );
      await trackSavedPairs(video.uuid);
    }
    for (const video of tieVideos) {
      await db.execute(
        `INSERT INTO content_videos
          (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
         VALUES (?, 'DRAMA', ?, 'PREVIEW', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [video.uuid, savedDramaId, `api-test/${video.uuid}.mp4`, video.displayOrder],
      );
      await trackSavedPairs(video.uuid);
    }
    await db.execute(
      `INSERT INTO content_videos
        (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
       VALUES (?, 'EPISODE', ?, 'FULL', ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [paidVideo.uuid, savedEpisodeId, `api-test/${paidVideo.uuid}.mp4`, paidVideo.displayOrder],
    );
    stateFixtures.videos.push({ uuid: paidVideo.uuid });
    await trackSavedPairs(paidVideo.uuid);
    const addDrama = async (status, publishedAt) => {
      const uuid = randomUUID();
      const slug = `api-test-${uuid}`;
      stateFixtures.dramas.push({ uuid });
      const [result] = await db.execute(
        `INSERT INTO dramas (uuid, production_company_id, public_slug, title, short_description, synopsis, status, published_at, created_at, updated_at)
         SELECT ?, production_company_id, ?, 'API test fixture', 'Temporary API fixture', 'Temporary API fixture', ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
         FROM dramas WHERE id = ?`,
        [uuid, slug, status, publishedAt, selectedIds[0].id],
      );
      if (result.affectedRows !== 1) throw new Error('Could not create a saved-video publication fixture.');
      const [rows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [uuid]);
      stateFixtures.dramas[stateFixtures.dramas.length - 1].id = rows[0].id;
      return rows[0].id;
    };
    const addVideo = async (contentType, contentId, kind, displayOrder = 1) => {
      const uuid = randomUUID();
      stateFixtures.videos.push({ uuid });
      await db.execute(
        `INSERT INTO content_videos
          (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 60000, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [uuid, contentType, contentId, kind, `api-test/${uuid}.mp4`, displayOrder],
      );
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
      stateFixtures.episodes.push({ uuid: episodeUuid });
      const [episodeResult] = await db.execute(
        `INSERT INTO episodes (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at, created_at, updated_at)
         VALUES (?, ?, 1, 'API test fixture', 'Temporary API fixture', 60000, 0, 'PUBLISHED', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [episodeUuid, dramaId],
      );
      if (episodeResult.affectedRows !== 1) throw new Error('Could not create a saved-video parent fixture episode.');
      const [episodeRows] = await db.execute('SELECT id FROM episodes WHERE uuid = ?', [episodeUuid]);
      stateFixtures.episodes[stateFixtures.episodes.length - 1].id = episodeRows[0].id;
      parentCases.push({ key: `${key}-episode`, type: 'EPISODE', uuid: await addVideo('EPISODE', episodeRows[0].id, 'FULL') });
    }
    const hiddenDramaId = await addDrama('PUBLISHED', new Date(Date.now() - 60000));
    const hiddenVideoUuid = await addVideo('DRAMA', hiddenDramaId, 'PREVIEW');
    const kindMismatchVideoUuid = await addVideo('DRAMA', savedDramaId, 'FULL');
    const episodeCases = [];
    const episodeDramaId = await addDrama('PUBLISHED', new Date(Date.now() - 60000));
    let episodeNumber = 1;
    for (const [key, status, publishedAt] of [
      ['draft', 'DRAFT', null], ['scheduled', 'SCHEDULED', null],
      ['future', 'PUBLISHED', new Date(Date.now() + 86400000)], ['null', 'PUBLISHED', null],
    ]) {
      const uuid = randomUUID();
      stateFixtures.episodes.push({ uuid });
      const [result] = await db.execute(
        `INSERT INTO episodes (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at, created_at, updated_at)
         VALUES (?, ?, ?, 'API test fixture', 'Temporary API fixture', 60000, 0, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [uuid, episodeDramaId, episodeNumber++, status, publishedAt],
      );
      if (result.affectedRows !== 1) throw new Error('Could not create a saved-video episode fixture.');
      const [rows] = await db.execute('SELECT id FROM episodes WHERE uuid = ?', [uuid]);
      stateFixtures.episodes[stateFixtures.episodes.length - 1].id = rows[0].id;
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
      entitledUserUuid: entitledUuid,
      unentitledUserUuid: unentitledUuid,
      entitlementDramaUuid: selected.uuid,
      entitledEpisodeUuid: paidEpisodeUuid,
      lockedEpisodeUuid,
      purchaseTestEpisodeUuid,
      pointIncreaseIdempotencyKey: `api-test:${fixtureContext.runId}:points:v1`,
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
    await coordinate('prepared', { suite: suites.map(suite => suite.id), runId: fixtureContext.runId,
      userUuids: fixtureContext.userUuids, progressPairs: ownedPairs });
    exitCode = await runSuites(['--environment', environmentFile], false);
    if (exitCode !== 0) throw new Error('Postman failed for the saved-videos API suite.');
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
    await coordinate('verified', { suite: suites.map(suite => suite.id), runId: fixtureContext.runId,
      userUuids: fixtureContext.userUuids, progressPairs: ownedPairs });
    })();
  } catch (error) {
    operationError = error;
  } finally {
    const cleanupErrors = [];
    const attemptCleanup = async action => {
      try { await action(); } catch (error) { cleanupErrors.push(error); }
    };
    try {
      for (const [collectionId, dramaId] of ownedCollectionLinks) {
        await attemptCleanup(() => db.execute('DELETE FROM collection_dramas WHERE collection_id = ? AND drama_id = ?', [collectionId, dramaId]));
      }
      for (const [userId, videoUuid] of ownedSavedPairs) {
        await attemptCleanup(() => db.execute(
          'DELETE saved FROM user_saved_videos saved JOIN content_videos video ON video.id = saved.video_id WHERE saved.user_id = ? AND video.uuid = ?',
          [userId, videoUuid],
        ));
      }
      if (savedVideoFixture) {
        const videoIds = [
          ...savedVideoFixture.previewVideos.map(video => video.uuid),
          ...(savedVideoFixture.otherUserVideo ? [savedVideoFixture.otherUserVideo.uuid] : []),
          ...savedVideoFixture.otherUserBaselineVideos.map(video => video.uuid),
          ...savedVideoFixture.tieVideos.map(video => video.uuid),
          ...(savedVideoFixture.paidVideo ? [savedVideoFixture.paidVideo.uuid] : []),
          ...savedVideoFixture.stateFixtures.videos.map(video => video.uuid),
        ];
        for (const videoUuid of videoIds) {
          await attemptCleanup(async () => {
            const [videos] = await db.execute('SELECT id FROM content_videos WHERE uuid = ?', [videoUuid]);
            if (videos.length) await db.execute('DELETE FROM content_videos WHERE id = ?', [videos[0].id]);
          });
        }
        for (const episode of [...savedVideoFixture.stateFixtures.episodes].reverse()) {
          await attemptCleanup(() => db.execute('DELETE FROM episodes WHERE uuid = ?', [episode.uuid]));
        }
        for (const imageUuid of savedVideoFixture.stateFixtures.images) {
          await attemptCleanup(() => db.execute('DELETE FROM content_images WHERE uuid = ?', [imageUuid]));
        }
        for (const drama of [...savedVideoFixture.stateFixtures.dramas].reverse()) {
          await attemptCleanup(async () => {
            const [rows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [drama.uuid]);
            if (rows.length) await db.execute('DELETE FROM drama_genres WHERE drama_id = ?', [rows[0].id]);
          });
        }
        for (const drama of [...savedVideoFixture.stateFixtures.dramas].reverse()) {
          await attemptCleanup(() => db.execute('DELETE FROM dramas WHERE uuid = ?', [drama.uuid]));
        }
      }
      for (const token of prepRefreshTokens) {
        await attemptCleanup(async () => {
          const response = await fetch(`${baseUrl}/auth/logout`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token }),
          });
          if (response.status !== 204) throw new Error('Could not log out the saved-video preparation session.');
        });
      }
      await attemptCleanup(() => fixtureContext.cleanup());
      if (!cleanupErrors.length) process.send?.({ type: 'cleaned', suite: suites.map(suite => suite.id), runId: fixtureContext.runId,
        userUuids: fixtureContext.userUuids, progressPairs: ownedPairs });
    } finally {
      await attemptCleanup(() => db.end());
      if (directory) await attemptCleanup(() => rmSync(directory, { recursive: true, force: true }));
      await attemptCleanup(() => releaseFixtureLock());
      if (cleanupErrors.length) cleanupError = new AggregateError(cleanupErrors, 'Could not clean every owned API fixture.');
    }
  }
  if (operationError && cleanupError) throw new AggregateError([operationError, cleanupError], 'API test run and fixture cleanup both failed.');
  if (operationError) throw operationError;
  if (cleanupError) throw cleanupError;
  return exitCode;
}

export { main, runPostman };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await main();
  } catch (error) {
  // Do not log DB parameters, passwords, tokens, or the temporary environment.
  console.error(`API test runner failed: ${error.code ?? error.message}`);
  process.exitCode = 1;
  } finally {
    if (process.send) process.disconnect();
  }
}
