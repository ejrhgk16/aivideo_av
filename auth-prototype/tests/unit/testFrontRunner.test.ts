import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRoot = process.cwd();
const runnerPath = join(projectRoot, 'scripts/test-front.cjs');
const { resolveTests } = require(runnerPath) as {
  resolveTests(args: string[], root: string): string[];
};

test('selection resolves exact test files, sorts, and removes duplicates', () => {
  expect(resolveTests(
    ['tests/unit/media.test.ts', 'tests/unit/savedVideos.test.ts', 'tests/unit/media.test.ts'],
    projectRoot,
  )).toEqual(['tests/unit/media.test.ts', 'tests/unit/savedVideos.test.ts']);
});

test('selection rejects paths outside tests, missing files, and options', () => {
  for (const argument of [
    '../front/src/common/media.ts',
    'src/common/media.ts',
    'tests/unit/missing.test.ts',
    '--help',
  ]) {
    expect(() => resolveTests([argument], projectRoot)).toThrow();
  }
});

test('no arguments discovers nested TypeScript tests and rejects an empty tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'front-test-selection-'));
  try {
    mkdirSync(join(root, 'tests', 'nested'), { recursive: true });
    writeFileSync(join(root, 'tests', 'b.test.tsx'), '');
    writeFileSync(join(root, 'tests', 'nested', 'a.test.ts'), '');
    writeFileSync(join(root, 'tests', 'ignored.ts'), '');
    expect(resolveTests([], root)).toEqual(['tests/b.test.tsx', 'tests/nested/a.test.ts']);
    rmSync(join(root, 'tests', 'b.test.tsx'));
    rmSync(join(root, 'tests', 'nested', 'a.test.ts'));
    expect(() => resolveTests([], root)).toThrow('No test files found');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function runSelected(file: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [runnerPath, file], { cwd: projectRoot });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolveResult({ code, output }));
  });
}

test('selected Jest subprocesses run only their requested tests and isolate concurrent outputs', async () => {
  const [media, savedVideos] = await Promise.all([
    runSelected('tests/unit/media.test.ts'),
    runSelected('tests/unit/savedVideos.test.ts'),
  ]);
  expect(media.code).toBe(0);
  expect(media.output).toMatch(/media\.test\.ts/);
  expect(media.output).not.toMatch(/savedVideos\.test\.ts/);
  expect(savedVideos.code).toBe(0);
  expect(savedVideos.output).toMatch(/savedVideos\.test\.ts/);
  expect(savedVideos.output).not.toMatch(/media\.test\.ts/);
}, 60000);

test('Jest nonzero, signal, and spawn failures return a failure code', () => {
  const spawnSync = jest.fn();
  jest.doMock('node:child_process', () => ({ spawnSync }));
  try {
    let run: (files: string[], root: string) => number;
    jest.isolateModules(() => {
      run = (require('../../scripts/test-front.cjs') as {
        run(files: string[], root: string): number;
      }).run;
    });

    spawnSync.mockReturnValueOnce({ status: 7, signal: null });
    expect(run!(['tests/unit/media.test.ts'], projectRoot)).toBe(7);
    expect(spawnSync).toHaveBeenLastCalledWith(
      process.execPath,
      expect.arrayContaining(['--runInBand', '--runTestsByPath', 'tests/unit/media.test.ts']),
      expect.objectContaining({ cwd: projectRoot, stdio: 'inherit' }),
    );

    spawnSync.mockReturnValueOnce({ status: null, signal: 'SIGTERM' });
    expect(run!(['tests/unit/media.test.ts'], projectRoot)).toBe(1);

    spawnSync.mockReturnValueOnce({ status: null, signal: null, error: new Error('spawn failed') });
    expect(run!(['tests/unit/media.test.ts'], projectRoot)).toBe(1);
  } finally {
    jest.dontMock('node:child_process');
  }
});
