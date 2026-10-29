import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { ApiError } from '../../src/common/http/api';

const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');
type Input = { event: 'STARTED' | 'COMPLETED'; positionMs: number };
type Timer = { run(): void; delay: number };

function loadModule(apiCalls: unknown[]) {
  const source = readFileSync(resolve(process.cwd(), 'src/features/playback/watchProgress.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(compiled, { exports: module.exports, TypeError, require: (id: string) => {
    if (id === '../../common/http/api') return { ApiError };
    if (id === '../user/sessionClient') return { apiRequest: (...args: unknown[]) => { apiCalls.push(args); return Promise.resolve(); } };
    throw new Error(`Unexpected module: ${id}`);
  } });
  return module.exports as {
    saveWatchProgress: (episodeId: string, input: Input) => Promise<void>;
    createWatchProgressTracker: (send: (input: Input) => Promise<void>, isCurrent: () => boolean, timer?: {
      set(callback: () => void, delay: number): unknown;
      clear(handle: unknown): void;
    }) => { onProgress(positionMs: number, durationMs: number): void; dispose(): void };
  };
}

function createTimer() {
  let nextId = 0;
  const pending = new Map<number, Timer>();
  return {
    pending,
    scheduler: {
      set(callback: () => void, delay: number) {
        const id = ++nextId;
        pending.set(id, { run: callback, delay });
        return id;
      },
      clear(handle: unknown) { pending.delete(handle as number); },
    },
    fire() {
      const entry = pending.entries().next().value as [number, Timer] | undefined;
      assert.ok(entry, 'expected a scheduled timer');
      pending.delete(entry[0]);
      entry[1].run();
    },
  };
}

const flush = async () => { await new Promise<void>((resolve) => setImmediate(resolve)); };
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test('saveWatchProgress uses a required-auth PUT and encodes the episode id', async () => {
  const calls: unknown[] = [];
  const { saveWatchProgress } = loadModule(calls);
  await saveWatchProgress('episode/1', { event: 'STARTED', positionMs: 0 });
  assert.deepEqual(plain(calls), [[
    '/me/episodes/episode%2F1/watch-progress',
    { auth: 'required', method: 'PUT', json: { event: 'STARTED', positionMs: 0 } },
  ]]);
});

test('progress events are consumed once and sent in order while a request is pending', async () => {
  const calls: Input[] = [];
  let finishStart: (() => void) | undefined;
  const { createWatchProgressTracker } = loadModule([]);
  const tracker = createWatchProgressTracker((input) => {
    calls.push(input);
    if (input.event === 'STARTED') return new Promise<void>((resolve) => { finishStart = resolve; });
    return Promise.resolve();
  }, () => true);

  tracker.onProgress(1000, 3000);
  tracker.onProgress(1999, 3000);
  tracker.onProgress(2000, 3000);
  tracker.onProgress(2500, 3000);
  await flush();
  assert.deepEqual(plain(calls), [{ event: 'STARTED', positionMs: 0 }]);
  finishStart?.();
  await flush();
  assert.deepEqual(plain(calls), [
    { event: 'STARTED', positionMs: 0 },
    { event: 'COMPLETED', positionMs: 2000 },
  ]);
  tracker.dispose();
});

test('a network failure retries once after two seconds and keeps the completion position', async () => {
  const calls: Input[] = [];
  const clock = createTimer();
  let first = true;
  const { createWatchProgressTracker } = loadModule([]);
  const tracker = createWatchProgressTracker(async (input) => {
    calls.push(input);
    if (first) { first = false; throw new TypeError('offline'); }
  }, () => true, clock.scheduler);

  tracker.onProgress(2000, 3000);
  tracker.onProgress(2800, 3000);
  await flush();
  assert.deepEqual(plain(calls), [{ event: 'STARTED', positionMs: 0 }]);
  assert.deepEqual([...clock.pending.values()].map(({ delay }) => delay), [2000]);
  clock.fire();
  await flush();
  assert.deepEqual(plain(calls), [
    { event: 'STARTED', positionMs: 0 },
    { event: 'STARTED', positionMs: 0 },
    { event: 'COMPLETED', positionMs: 2000 },
  ]);
  tracker.dispose();
});

test('4xx failures are not retried and dispose cancels a pending retry', async () => {
  const calls: Input[] = [];
  const clock = createTimer();
  const { createWatchProgressTracker } = loadModule([]);
  const rejected = createWatchProgressTracker(async (input) => {
    calls.push(input);
    throw new ApiError(403, 'EPISODE_ACCESS_DENIED');
  }, () => true, clock.scheduler);
  rejected.onProgress(1000, 3000);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(clock.pending.size, 0);
  rejected.dispose();

  const retryCalls: Input[] = [];
  const canceled = createWatchProgressTracker(async (input) => {
    retryCalls.push(input);
    throw new ApiError(503, null);
  }, () => true, clock.scheduler);
  canceled.onProgress(1000, 3000);
  await flush();
  assert.equal(clock.pending.size, 1);
  canceled.dispose();
  assert.equal(clock.pending.size, 0);
  await flush();
  assert.equal(retryCalls.length, 1);
});

test('a retryable error is attempted only twice, even while progress events continue', async () => {
  const calls: Input[] = [];
  const clock = createTimer();
  const { createWatchProgressTracker } = loadModule([]);
  const tracker = createWatchProgressTracker(async (input) => {
    calls.push(input);
    throw new ApiError(503, null);
  }, () => true, clock.scheduler);

  tracker.onProgress(1000, 3000);
  tracker.onProgress(1200, 3000);
  await flush();
  clock.fire();
  await flush();
  tracker.onProgress(1400, 3000);
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(clock.pending.size, 0);
  tracker.dispose();
});

test('stale sessions and invalid durations do not enqueue requests', async () => {
  const calls: Input[] = [];
  let current = true;
  const { createWatchProgressTracker } = loadModule([]);
  const tracker = createWatchProgressTracker(async (input) => { calls.push(input); }, () => current);
  tracker.onProgress(1000, 0);
  current = false;
  tracker.onProgress(1000, 3000);
  await flush();
  assert.deepEqual(plain(calls), []);
  tracker.dispose();
});
