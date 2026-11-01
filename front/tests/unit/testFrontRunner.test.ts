/// <reference types="node" />

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const projectRoot = process.cwd();
const runnerPath = join(projectRoot, 'scripts/test-front.cjs');
const { resolveTests } = require(runnerPath) as {
  resolveTests(args: string[], root: string): string[];
};

test('selection resolves exact test files, sorts, and removes duplicates', () => {
  assert.deepEqual(
    resolveTests(['tests/unit/media.test.ts', 'tests/unit/savedVideos.test.ts', 'tests/unit/media.test.ts'], projectRoot),
    ['tests/unit/media.test.ts', 'tests/unit/savedVideos.test.ts'],
  );
});

test('selection rejects paths outside tests, missing files, and options', () => {
  for (const argument of [
    '../front/src/common/media.ts',
    'src/common/media.ts',
    'tests/unit/missing.test.ts',
    '--help',
  ]) {
    assert.throws(() => resolveTests([argument], projectRoot));
  }
});

test('no arguments discovers nested TypeScript tests and rejects an empty tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'front-test-selection-'));
  try {
    mkdirSync(join(root, 'tests', 'nested'), { recursive: true });
    writeFileSync(join(root, 'tests', 'b.test.tsx'), '');
    writeFileSync(join(root, 'tests', 'nested', 'a.test.ts'), '');
    writeFileSync(join(root, 'tests', 'ignored.ts'), '');
    assert.deepEqual(resolveTests([], root), ['tests/b.test.tsx', 'tests/nested/a.test.ts']);
    rmSync(join(root, 'tests', 'b.test.tsx'));
    rmSync(join(root, 'tests', 'nested', 'a.test.ts'));
    assert.throws(() => resolveTests([], root), /No test files found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function runSelected(file: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolveResult, reject) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, [runnerPath, file], { cwd: projectRoot, env });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolveResult({ code, output }));
  });
}

test('selected subprocesses run only their requested tests and isolate concurrent outputs', async () => {
  const [media, savedVideos] = await Promise.all([
    runSelected('tests/unit/media.test.ts'),
    runSelected('tests/unit/savedVideos.test.ts'),
  ]);
  assert.equal(media.code, 0, media.output);
  assert.match(media.output, /relative API image paths resolve/);
  assert.doesNotMatch(media.output, /saved-video requests/);
  assert.equal(savedVideos.code, 0, savedVideos.output);
  assert.match(savedVideos.output, /saved-video requests use required auth/);
  assert.doesNotMatch(savedVideos.output, /relative API image paths resolve/);
});
