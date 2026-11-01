import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_TIMEOUT_MS = 10 * 60_000;

export async function acquireContentLock(baseUrl, mode, options = {}) {
  if (!['shared', 'exclusive'].includes(mode)) throw new Error(`Unknown content lock mode: ${mode}`);
  const root = options.root ?? join(tmpdir(), 'aivideo-api-content-locks');
  const target = new URL(baseUrl);
  target.hash = '';
  target.search = '';
  target.hostname = target.hostname.toLowerCase();
  target.pathname = target.pathname.replace(/\/+$/, '') || '/';
  const key = createHash('sha256').update(target.href).digest('hex');
  const directory = join(root, key);
  const gate = join(directory, 'gate');
  const reader = join(directory, `reader-${process.pid}-${randomUUID()}`);
  const writer = join(directory, 'writer');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signal = options.signal;
  mkdirSync(directory, { recursive: true });

  async function withGate(operation, observeAbort = true) {
    const end = Date.now() + timeoutMs;
    while (true) {
      if (observeAbort) signal?.throwIfAborted();
      try {
        mkdirSync(gate);
        try { return operation(); } finally { rmSync(gate, { recursive: true, force: true }); }
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() >= end) throw new Error('Timed out waiting for API content lock gate.');
        await delay(20, undefined, observeAbort ? { signal } : undefined);
      }
    }
  }

  const end = Date.now() + timeoutMs;
  let reportedWait = false;
  while (true) {
    signal?.throwIfAborted();
    const acquired = await withGate(() => {
      const names = readdirSync(directory);
      const writerPresent = names.includes('writer');
      const readersPresent = names.some(name => name.startsWith('reader-'));
      if (mode === 'shared' && !writerPresent) {
        writeFileSync(reader, String(process.pid), { flag: 'wx' });
        return true;
      }
      if (mode === 'exclusive' && !writerPresent && !readersPresent) {
        writeFileSync(writer, String(process.pid), { flag: 'wx' });
        return true;
      }
      return false;
    });
    if (acquired) break;
    if (!reportedWait) {
      reportedWait = true;
      options.onWait?.();
    }
    if (Date.now() >= end) throw new Error(`Timed out waiting for ${mode} API content lock.`);
    await delay(30, undefined, { signal });
  }

  let released = false;
  return async () => {
    if (released) return;
    await withGate(() => {
      const marker = mode === 'shared' ? reader : writer;
      if (existsSync(marker)) rmSync(marker);
      released = true;
    }, false);
  };
}
