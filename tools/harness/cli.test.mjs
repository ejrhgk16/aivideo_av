import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { completeTask, failTask, finishPlan, getNext, readIndex, resetTask, retryTask, startTask, validateIndex, validatePlansIndex } from './cli.mjs';

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
    plans: [{ id: 'plan-1-test', directory: 'plan-1-test', title: 'Test', status }],
  }, null, 2)}\n`);
  writeFileSync(join(repo, '_docs', 'plans', 'plan-1-test', 'index.json'), `${JSON.stringify({
    version: 1,
    plan_id: 'plan-1-test',
    tasks,
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
  assert.throws(() => validatePlansIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [] }] }), /plan index/);
});

test('task transitions respect dependencies, retry errors, and reset a blocked task', () => {
  const repo = temporaryDirectory();
  writePlan(repo, [task('first'), task('second', { depends_on: ['first'] })]);
  assert.equal(getNext(repo, 'plan-1-test').task.id, 'first');
  startTask(repo, 'plan-1-test', 'first');
  assert.equal(getNext(repo, 'plan-1-test').state, 'wait');
  assert.equal(Object.hasOwn(JSON.parse(readFileSync(join(repo, '_docs', 'plans', 'index.json'), 'utf8')).plans[0], 'tasks'), false);
  assert.equal(JSON.parse(readFileSync(join(repo, '_docs', 'plans', 'plan-1-test', 'index.json'), 'utf8')).tasks[0].status, 'in_progress');
  completeTask(repo, 'plan-1-test', 'first', 'done');
  assert.equal(getNext(repo, 'plan-1-test').task.id, 'second');
  startTask(repo, 'plan-1-test', 'second');
  failTask(repo, 'plan-1-test', 'second', 'broken');
  assert.equal(getNext(repo, 'plan-1-test').state, 'error');
  const retry = spawnSync(process.execPath, [join(process.cwd(), 'tools', 'harness', 'cli.mjs'), 'retry', '--plan', 'plan-1-test', '--task', 'second'], { cwd: repo, encoding: 'utf8' });
  assert.equal(retry.status, 0, retry.stderr);
  assert.deepEqual(JSON.parse(retry.stdout), { plan: 'plan-1-test', task: 'second', status: 'in_progress', failureCount: 1 });
  failTask(repo, 'plan-1-test', 'second', 'still broken');
  assert.equal(retryTask(repo, 'plan-1-test', 'second').status, 'in_progress');
  const blocked = failTask(repo, 'plan-1-test', 'second', 'broken again');
  assert.equal(blocked.status, 'blocked');
  assert.equal(getNext(repo, 'plan-1-test').state, 'blocked');
  resetTask(repo, 'plan-1-test', 'second');
  assert.equal(getNext(repo, 'plan-1-test').task.id, 'second');
  assert.equal(readIndex(repo).plans[0].status, 'active');
});

test('finish checks product paths but commits all non-ignored dirty files', () => {
  const repo = temporaryDirectory();
  git(repo, 'init', '--initial-branch=dev');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'user.name', 'Harness Test');
  writePlan(repo, [task('complete', {
    status: 'completed',
    files: ['back/src/complete.mjs'],
  }), task('docs', {
    status: 'completed',
    files: ['tools/harness/docs.mjs'],
    checks: ['node -e "process.exit(1)"'],
  })], 'completed');
  mkdirSync(join(repo, 'back', 'src'), { recursive: true });
  writeFileSync(join(repo, 'back', 'package.json'), JSON.stringify({
    scripts: {
      lint: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
      build: 'node -e "process.exit(0)"',
    },
  }, null, 2));
  writeFileSync(join(repo, 'back', 'src', 'complete.mjs'), 'export const value = 1;\n');
  const remote = temporaryDirectory();
  git(remote, 'init', '--bare');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'initial');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-u', 'origin', 'dev');

  writeFileSync(join(repo, '.gitignore'), '/_docs/AI_DRAMA_data_model/\n');
  mkdirSync(join(repo, '_docs', 'AI_DRAMA_data_model'), { recursive: true });
  writeFileSync(join(repo, '_docs', 'AI_DRAMA_data_model', 'ignored.md'), 'leave me out\n');
  writeFileSync(join(repo, 'outside.txt'), 'ignore me\n');
  writeFileSync(join(repo, 'back', 'src', 'undeclared.mjs'), 'export const value = 0;\n');
  writeFileSync(join(repo, '_docs', 'plans', 'plan-1-test', 'plan.md'), '# Updated test plan\n');
  writeFileSync(join(repo, 'back', 'src', 'complete.mjs'), 'export const value = 2;\n');
  assert.deepEqual(finishPlan(repo, 'plan-1-test'), { plan: 'plan-1-test', committed: true, pushed: true });
  assert.doesNotMatch(git(repo, 'status', '--short', '--untracked-files=all'), /outside\.txt|undeclared\.mjs/);
  assert.match(git(repo, 'show', '--format=', '--name-only', 'HEAD'), /\.gitignore/);
  assert.match(git(repo, 'show', '--format=', '--name-only', 'HEAD'), /outside\.txt/);
  assert.match(git(repo, 'show', '--format=', '--name-only', 'HEAD'), /undeclared\.mjs/);
  assert.match(git(repo, 'check-ignore', '-v', '_docs/AI_DRAMA_data_model/ignored.md'), /AI_DRAMA_data_model/);
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
