import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'mysql2/promise';
import './run.mjs';

const baseUrl = 'http://localhost:3000';
const runnerPath = fileURLToPath(new URL('./run.mjs', import.meta.url));
const timeoutMs = 5 * 60_000;

function startRunner(suite) {
  const child = fork(runnerPath, ['--suite', suite], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const messages = [];
  const exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  child.on('message', message => messages.push(message));
  child.on('error', error => messages.push({ type: 'error', message: error.message }));
  child.on('exit', code => {
    if (code !== 0) messages.push({ type: 'error', message: `Runner exited with code ${code}.` });
  });
  const next = type => new Promise((resolve, reject) => {
    const end = Date.now() + timeoutMs;
    const poll = () => {
      const errorIndex = messages.findIndex(message => message.type === 'error');
      if (errorIndex >= 0) return reject(new Error(messages.splice(errorIndex, 1)[0].message));
      const messageIndex = messages.findIndex(message => message.type === type);
      if (messageIndex >= 0) return resolve(messages.splice(messageIndex, 1)[0]);
      if (Date.now() >= end) return reject(new Error(`Runner did not report ${type}.`));
      setTimeout(poll, 20);
    };
    poll();
  });
  return {
    child,
    exit,
    next,
    send: type => {
      if (!child.connected) return;
      try { child.send({ type }, () => {}); } catch {}
    },
  };
}

async function database() {
  for (const name of ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']) {
    if (!process.env[name]) throw new Error(`Required environment variable is missing: ${name}`);
  }
  return createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: 'Z',
  });
}

async function waitExit(runner) {
  if (runner.child.exitCode !== null) {
    if (runner.child.exitCode === 0) return;
    throw new Error(`Runner exited with code ${runner.child.exitCode}.`);
  }
  let timer;
  const code = await Promise.race([
    runner.exit,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Runner did not exit within the bounded wait.')), 10_000); }),
  ]).finally(() => clearTimeout(timer));
  if (code !== 0) throw new Error(`Runner exited with code ${code}.`);
}

async function stopRunners(runners) {
  for (const runner of runners) runner.send('abort');
  const results = await Promise.allSettled(runners.map(waitExit));
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length) throw new AggregateError(failures, `One or more parallel API runners did not stop cleanly: ${failures.map(error => error.message).join('; ')}`);
}

async function coordinateProgressRuns(db) {
  const first = startRunner('watch-progress');
  const second = startRunner('watch-progress');
  try {
    const [firstReady, secondReady] = await Promise.all([first.next('prepared'), second.next('prepared')]);
    if (firstReady.runId === secondReady.runId || firstReady.userUuids.some(uuid => secondReady.userUuids.includes(uuid))) {
      throw new Error('Parallel watch-progress runs reused a run ID or user UUID.');
    }
    first.send('start');
    second.send('start');
    const [firstVerified, secondVerified] = await Promise.all([first.next('verified'), second.next('verified')]);
    for (const [userId, episodeId] of secondVerified.progressPairs) {
      const [rows] = await db.execute('SELECT user_id FROM user_watch_progress WHERE user_id = ? AND episode_id = ?', [userId, episodeId]);
      if (rows.length !== 1) throw new Error('The second watch-progress fixture row was not present before cleanup.');
    }

    first.send('cleanup');
    await first.next('cleaned');
    const [secondUsers] = await db.execute(
      `SELECT uuid FROM users WHERE uuid IN (${secondVerified.userUuids.map(() => '?').join(',')})`,
      secondVerified.userUuids,
    );
    if (secondUsers.length !== secondVerified.userUuids.length) throw new Error('The second run users were removed during the first cleanup.');
    for (const [userId, episodeId] of secondVerified.progressPairs) {
      const [rows] = await db.execute('SELECT user_id FROM user_watch_progress WHERE user_id = ? AND episode_id = ?', [userId, episodeId]);
      if (rows.length !== 1) throw new Error('The first cleanup removed the second run progress row.');
    }
    second.send('cleanup');
    await second.next('cleaned');
    for (const run of [firstVerified, secondVerified]) {
      for (const [userId, episodeId] of run.progressPairs) {
        const [rows] = await db.execute('SELECT user_id FROM user_watch_progress WHERE user_id = ? AND episode_id = ?', [userId, episodeId]);
        if (rows.length) throw new Error('A watch-progress fixture row remained after its owning run cleanup.');
      }
      const [rows] = await db.execute(
        `SELECT uuid FROM users WHERE uuid IN (${run.userUuids.map(() => '?').join(',')})`, run.userUuids,
      );
      if (rows.length) throw new Error('A run-specific user remained after cleanup.');
    }
  } finally {
    await stopRunners([first, second]);
  }
}

async function coordinateContentWriter() {
  const reader = startRunner('content');
  let writer;
  try {
    await reader.next('prepared');
    reader.send('start');
    await reader.next('verified');
    writer = startRunner('saved-videos');
    await writer.next('lock-waiting');
    reader.send('cleanup');
    await reader.next('cleaned');
    await writer.next('prepared');
    writer.send('start');
    await writer.next('verified');
    writer.send('cleanup');
    await writer.next('cleaned');
  } finally {
    await stopRunners([reader, ...(writer ? [writer] : [])]);
  }
}

async function verify() {
  const response = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!response?.ok) throw new Error('API unavailable. Run: npm --prefix back run start:dev');
  const db = await database();
  try {
    await coordinateProgressRuns(db);
    await coordinateContentWriter();
  } finally {
    await db.end();
  }
}

verify().then(() => console.log('Parallel watch-progress isolation and shared/exclusive API content locking passed.')).catch(error => {
  console.error(`Parallel API verification failed: ${error.message}`);
  process.exitCode = 1;
});
