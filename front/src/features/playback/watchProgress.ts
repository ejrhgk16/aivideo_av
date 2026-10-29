import { ApiError } from '../../common/http/api';
import { apiRequest } from '../user/sessionClient';

export type WatchProgressInput = {
  event: 'STARTED' | 'COMPLETED';
  positionMs: number;
};

export function saveWatchProgress(episodeId: string, input: WatchProgressInput): Promise<void> {
  return apiRequest<void>(`/me/episodes/${encodeURIComponent(episodeId)}/watch-progress`, {
    auth: 'required',
    method: 'PUT',
    json: input,
  });
}

type RetryTimer = {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
};

const retryTimer: RetryTimer = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createWatchProgressTracker(
  send: (input: WatchProgressInput) => Promise<void>,
  isCurrent: () => boolean,
  timer: RetryTimer = retryTimer,
) {
  let disposed = false;
  let started = false;
  let completed = false;
  let tail = Promise.resolve();
  let timerHandle: unknown;
  let releaseWait: (() => void) | undefined;
  const current = () => !disposed && isCurrent();

  function stopWaiting() {
    if (timerHandle !== undefined) timer.clear(timerHandle);
    releaseWait?.();
    timerHandle = undefined;
    releaseWait = undefined;
  }

  async function deliver(input: WatchProgressInput) {
    for (let attempt = 0; attempt < 2 && current(); attempt += 1) {
      try {
        await send(input);
        return;
      } catch (error) {
        const retryable = error instanceof TypeError ||
          (error instanceof ApiError && error.status >= 500 && error.status < 600);
        if (!retryable || attempt === 1 || !current()) return;
        await new Promise<void>((resolve) => {
          releaseWait = resolve;
          timerHandle = timer.set(() => {
            timerHandle = undefined;
            releaseWait = undefined;
            resolve();
          }, 2000);
        });
      }
    }
  }

  function enqueue(input: WatchProgressInput) {
    tail = tail.then(() => current() ? deliver(input) : undefined);
  }

  return {
    onProgress(positionMs: number, durationMs: number) {
      if (!current() || !Number.isFinite(durationMs) || durationMs <= 0) return;
      if (!started) {
        started = true;
        enqueue({ event: 'STARTED', positionMs: 0 });
      }
      if (!completed && Number.isFinite(positionMs) && positionMs * 3 >= durationMs * 2) {
        completed = true;
        enqueue({ event: 'COMPLETED', positionMs });
      }
    },
    dispose() {
      disposed = true;
      stopWaiting();
    },
  };
}
