import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
    directory = mkdtempSync(join(tmpdir(), 'aivideo-postman-'));
    const environmentFile = join(directory, 'environment.json');
    const values = {
      entitledLoginId: entitled.login_id, entitledPassword: entitled.password,
      unentitledLoginId: unentitled.login_id, unentitledPassword: unentitled.password,
    };
    writeFileSync(environmentFile, JSON.stringify({ name: 'Local API test', values:
      Object.entries(values).map(([key, value]) => ({ key, value, enabled: true, type: 'secret' })) }), { mode: 0o600 });
    exitCode = await runPostman(['--environment', environmentFile]);
  } finally {
    try {
      for (const pair of ownedPairs) {
        await db.execute('DELETE FROM user_watch_progress WHERE user_id = ? AND episode_id = ?', pair);
      }
    } finally {
      try {
        if (temporaryLogin) {
          const [result] = await db.execute(
            'UPDATE users SET login_id = NULL, password = NULL WHERE id = ? AND login_id = ? AND password = ?',
            [temporaryLogin.id, temporaryLogin.loginId, temporaryLogin.password],
          );
          if (result.affectedRows !== 1) cleanupError = new Error('Could not restore temporary fixture credentials.');
        }
      } finally {
        await db.end();
        if (directory) rmSync(directory, { recursive: true, force: true });
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
