import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireContentLock } from '../../api/contentLock.mjs';

describe('API content lock', () => {
  it('allows nested readers and excludes a writer until both release', async () => {
    const root = mkdtempSync(join(tmpdir(), 'api-content-lock-test-'));
    const first = await acquireContentLock('http://localhost:3000/api/', 'shared', { root, timeoutMs: 1000 });
    const second = await acquireContentLock('http://localhost:3000/api', 'shared', { root, timeoutMs: 1000 });
    await expect(acquireContentLock('http://localhost:3000/api', 'exclusive', { root, timeoutMs: 80 }))
      .rejects.toThrow('Timed out waiting for exclusive');
    await first();
    await second();
    const writer = await acquireContentLock('http://localhost:3000/api', 'exclusive', { root, timeoutMs: 1000 });
    await writer();
    rmSync(root, { recursive: true, force: true });
  });

  it('coordinates markers across processes and releases only its own reader', async () => {
    const root = mkdtempSync(join(tmpdir(), 'api-content-lock-process-'));
    const release = await acquireContentLock('http://localhost:3000', 'shared', { root });
    const script = `import {acquireContentLock} from ${JSON.stringify(new URL('../../api/contentLock.mjs', import.meta.url).href)}; await acquireContentLock('http://localhost:3000','exclusive',{root:process.argv[1],timeoutMs:100});`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script, root], { stdio: 'ignore' });
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    });
    expect(exitCode).not.toBe(0);
    await release();
    const writer = await acquireContentLock('http://localhost:3000', 'exclusive', { root, timeoutMs: 1000 });
    await writer();
    rmSync(root, { recursive: true, force: true });
  });

  it('aborts a waiting writer and normalizes only equivalent base URL spellings', async () => {
    const root = mkdtempSync(join(tmpdir(), 'api-content-lock-abort-'));
    const first = await acquireContentLock('http://LOCALHOST:3000/api/', 'shared', { root });
    const controller = new AbortController();
    const waitingWriter = acquireContentLock('http://localhost:3000/api', 'exclusive', {
      root, signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    await expect(waitingWriter).rejects.toMatchObject({ name: 'AbortError' });
    expect(readdirSync(join(root, readdirSync(root)[0]))).toHaveLength(1);
    await first();

    const ownedController = new AbortController();
    const ownedReader = await acquireContentLock('http://localhost:3000/api', 'shared', {
      root, signal: ownedController.signal,
    });
    ownedController.abort();
    await ownedReader();
    const writer = await acquireContentLock('http://localhost:3000/api', 'exclusive', { root });
    await writer();

    const prefixReader = await acquireContentLock('http://localhost:3000/other', 'shared', { root });
    expect(readdirSync(root)).toHaveLength(2);
    await prefixReader();
    rmSync(root, { recursive: true, force: true });
  });
});
