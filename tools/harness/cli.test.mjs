import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { completeTask, failTask, finishPlan, getNext, readIndex, resetTask, startTask, validateIndex } from './cli.mjs';

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'aivideo-harness-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  while (temporaryDirectories.length) rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

function writePlan(repo, tasks, status = 'draft') {
  mkdirSync(join(repo, '_docs', 'plans', 'plan-1-test'), { recursive: true });
  writeFileSync(join(repo, '_docs', 'plans', 'plan-1-test', 'plan.md'), '# Test plan\n');
  writeFileSync(join(repo, '_docs', 'plans', 'index.json'), `${JSON.stringify({
    version: 1,
    plans: [{ id: 'plan-1-test', directory: 'plan-1-test', title: 'Test', status, tasks }],
  }, null, 2)}\n`);
}

function task(id, overrides = {}) {
  return {
    id,
    name: id,
    status: 'pending',
    depends_on: [],
    files: [`tools/harness/${id}.mjs`],
    checks: [],
    ...overrides,
  };
}

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

test('validate rejects missing dependencies, cycles, overlapping parallel files, and invalid test locations', () => {
  assert.throws(() => validateIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [task('a', { depends_on: ['missing'] })] }] }), /unknown task/);
  assert.throws(() => validateIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [task('a', { depends_on: ['b'] }), task('b', { depends_on: ['a'] })] }] }), /cycle/);
  assert.throws(() => validateIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [task('a'), task('b', { files: ['tools/harness/a.mjs'] })] }] }), /share/);
  assert.throws(() => validateIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [task('a', { files: ['front/src/example.test.ts'] })] }] }), /approved location/);
  assert.throws(() => validateIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [task('a', { files: ['web-prototype/app.ts'] })] }] }), /web-prototype/);
});

test('task transitions respect dependencies, stop after failure, and reset an error', () => {
  const repo = temporaryDirectory();
  writePlan(repo, [task('first'), task('second', { depends_on: ['first'] })]);
  assert.equal(getNext(repo, 'plan-1-test').task.id, 'first');
  startTask(repo, 'plan-1-test', 'first');
  assert.equal(getNext(repo, 'plan-1-test').state, 'wait');
  completeTask(repo, 'plan-1-test', 'first', 'done');
  assert.equal(getNext(repo, 'plan-1-test').task.id, 'second');
  startTask(repo, 'plan-1-test', 'second');
  failTask(repo, 'plan-1-test', 'second', 'broken');
  assert.equal(getNext(repo, 'plan-1-test').state, 'error');
  resetTask(repo, 'plan-1-test', 'second');
  assert.equal(getNext(repo, 'plan-1-test').task.id, 'second');
  assert.equal(readIndex(repo).plans[0].status, 'active');
});

test('finish rejects undeclared dirty files, commits declared files, and can retry push against a local bare remote', () => {
  const repo = temporaryDirectory();
  git(repo, 'init', '--initial-branch=dev');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'user.name', 'Harness Test');
  writePlan(repo, [task('complete', { status: 'completed', files: ['tools/harness/complete.mjs'] })], 'completed');
  mkdirSync(join(repo, 'tools', 'harness'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'harness', 'complete.mjs'), 'export const value = 1;\n');
  const remote = temporaryDirectory();
  git(remote, 'init', '--bare');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'initial');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-u', 'origin', 'dev');

  writeFileSync(join(repo, 'unexpected.txt'), 'nope\n');
  assert.throws(() => finishPlan(repo, 'plan-1-test'), /Undeclared changes/);
  rmSync(join(repo, 'unexpected.txt'));
  writeFileSync(join(repo, 'tools', 'harness', 'complete.mjs'), 'export const value = 2;\n');
  assert.deepEqual(finishPlan(repo, 'plan-1-test'), { plan: 'plan-1-test', committed: true, pushed: true });
  assert.match(git(remote, 'log', '--oneline', 'dev'), /finish plan-1-test/);
  assert.deepEqual(finishPlan(repo, 'plan-1-test'), { plan: 'plan-1-test', committed: false, pushed: true });
});

test('CLI executable validates an index from the working directory', () => {
  const repo = temporaryDirectory();
  writePlan(repo, [task('one')]);
  const result = spawnSync(process.execPath, [join(process.cwd(), 'tools', 'harness', 'cli.mjs'), 'validate'], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { valid: true, plans: ['plan-1-test'] });
});
