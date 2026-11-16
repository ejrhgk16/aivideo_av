import { ApiError } from '../../src/common/http/api';
import { apiRequest } from '../../src/features/user/sessionClient';
import { createWatchProgressTracker, saveWatchProgress, type WatchProgressInput } from '../../src/features/playback/watchProgress';

jest.mock('../../src/features/user/sessionClient', () => ({ apiRequest: jest.fn() }));

type Timer = { run(): void; delay: number };

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
      expect(entry).toBeDefined();
      if (!entry) throw new Error('expected a scheduled retry timer');
      pending.delete(entry[0]);
      entry[1].run();
    },
  };
}

const flush = async () => { await new Promise<void>((resolve) => setImmediate(resolve)); };

beforeEach(() => {
  jest.mocked(apiRequest).mockReset();
  jest.mocked(apiRequest).mockResolvedValue(undefined);
});

test('saveWatchProgress uses a required-auth PUT and encodes the video UUID', async () => {
  await saveWatchProgress('video/1', { event: 'STARTED', positionMs: 0 });
  expect(apiRequest).toHaveBeenCalledWith(
    '/me/videos/video%2F1/watch-progress',
    { auth: 'required', method: 'PUT', json: { event: 'STARTED', positionMs: 0 } },
  );
});

test('progress events are consumed once and sent in order while a request is pending', async () => {
  const calls: WatchProgressInput[] = [];
  let finishStart!: () => void;
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
  expect(calls).toEqual([{ event: 'STARTED', positionMs: 0 }]);
  finishStart();
  await flush();
  expect(calls).toEqual([
    { event: 'STARTED', positionMs: 0 },
    { event: 'COMPLETED', positionMs: 2000 },
  ]);
  tracker.dispose();
});

test('a network failure retries once after two seconds and keeps the completion position', async () => {
  const calls: WatchProgressInput[] = [];
  const clock = createTimer();
  let first = true;
  const tracker = createWatchProgressTracker(async (input) => {
    calls.push(input);
    if (first) { first = false; throw new TypeError('offline'); }
  }, () => true, clock.scheduler);

  tracker.onProgress(2000, 3000);
  tracker.onProgress(2800, 3000);
  await flush();
  expect(calls).toEqual([{ event: 'STARTED', positionMs: 0 }]);
  expect([...clock.pending.values()].map(({ delay }) => delay)).toEqual([2000]);
  clock.fire();
  await flush();
  expect(calls).toEqual([
    { event: 'STARTED', positionMs: 0 },
    { event: 'STARTED', positionMs: 0 },
    { event: 'COMPLETED', positionMs: 2000 },
  ]);
  tracker.dispose();
});

test('4xx failures are not retried and dispose cancels a pending retry', async () => {
  const calls: WatchProgressInput[] = [];
  const clock = createTimer();
  const rejected = createWatchProgressTracker(async (input) => {
    calls.push(input);
    throw new ApiError(403, 'EPISODE_ACCESS_DENIED');
  }, () => true, clock.scheduler);
  rejected.onProgress(1000, 3000);
  await flush();
  expect(calls).toHaveLength(1);
  expect(clock.pending.size).toBe(0);
  rejected.dispose();

  const retryCalls: WatchProgressInput[] = [];
  const canceled = createWatchProgressTracker(async (input) => {
    retryCalls.push(input);
    throw new ApiError(503, null);
  }, () => true, clock.scheduler);
  canceled.onProgress(1000, 3000);
  await flush();
  expect(clock.pending.size).toBe(1);
  canceled.dispose();
  expect(clock.pending.size).toBe(0);
  await flush();
  expect(retryCalls).toHaveLength(1);
});

test('a retryable error is attempted only twice, even while progress events continue', async () => {
  const calls: WatchProgressInput[] = [];
  const clock = createTimer();
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
  expect(calls).toHaveLength(2);
  expect(clock.pending.size).toBe(0);
  tracker.dispose();
});

test('stale sessions and invalid durations do not enqueue requests', async () => {
  const calls: WatchProgressInput[] = [];
  let current = true;
  const tracker = createWatchProgressTracker(async (input) => { calls.push(input); }, () => current);
  tracker.onProgress(1000, 0);
  current = false;
  tracker.onProgress(1000, 3000);
  await flush();
  expect(calls).toEqual([]);
  tracker.dispose();
});
