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
  assert.throws(() => validateIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [task('a', { files: ['back/src/public.postman_collection.json'] })] }] }), /approved location/);
  assert.throws(() => validateIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [task('a', { files: ['web-prototype/app.ts'] })] }] }), /web-prototype/);
  assert.throws(() => validatePlansIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [] }] }), /plan index/);
});

test('validate accepts Postman collections in the backend API test directory', () => {
  assert.doesNotThrow(() => validateIndex({ version: 1, plans: [{ id: 'plan-1-test', directory: 'plan-1-test', status: 'draft', tasks: [task('api', { files: ['back/test/api/public.postman_collection.json'], checks: ['npm --prefix back run test:api'] })] }] }));
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
  assert.equal(git(remote, 'log', '-1', '--format=%s', 'dev'), 'finish plan-1-test');
  assert.deepEqual(finishPlan(repo, 'plan-1-test'), { plan: 'plan-1-test', committed: false, pushed: true });
});

test('CLI executable validates an index from the working directory', () => {
  const repo = temporaryDirectory();
  writePlan(repo, [task('one')]);
  const result = spawnSync(process.execPath, [join(process.cwd(), 'tools', 'harness', 'cli.mjs'), 'validate'], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { valid: true, plans: ['plan-1-test'] });
});

test('finish excludes draft folders and repeated CLI paths while keeping the local catalog intact', () => {
  const repo = temporaryDirectory();
  const remote = temporaryDirectory();
  git(repo, 'init', '--initial-branch=dev');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'user.name', 'Harness Test');
  git(remote, 'init', '--bare');
  writePlan(repo, [task('complete', { status: 'completed' })], 'completed');
  const catalogPath = join(repo, '_docs', 'plans', 'index.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  function addDraft(id) {
    const directory = join(repo, '_docs', 'plans', id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'index.json'), JSON.stringify({ version: 1, plan_id: id, tasks: [task('draft')] }));
    writeFileSync(join(directory, 'plan.md'), '# Draft\n');
    const entry = { id, directory: id, title: id, status: 'draft' };
    catalog.plans.push(entry);
    writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    return entry;
  }
  const previousDraft = { ...addDraft('plan-2-existing') };
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'initial');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-u', 'origin', 'dev');

  catalog.plans[0].title = 'Finished plan';
  catalog.plans[1].title = 'Local draft changes';
  addDraft('plan-3-local');
  const localCatalog = readFileSync(catalogPath, 'utf8');
  const existingDraftFile = '_docs/plans/plan-2-existing/plan.md';
  writeFileSync(join(repo, existingDraftFile), '# Local draft changes\n');
  writeFileSync(join(repo, 'local notes.txt'), 'keep local\n');
  writeFileSync(join(repo, 'included [draft].md'), 'publish this file\n');
  const excluded = ['_docs/plans/plan-2-existing', '_docs/plans/plan-3-local/', 'local notes.txt'];
  const before = git(repo, 'rev-parse', 'HEAD');
  for (const invalid of ['..', 'folder/..', '/outside', 'C:/outside']) {
    assert.throws(() => finishPlan(repo, 'plan-1-test', undefined, { exclude: [invalid] }), /Path must be repository-relative/);
  }
  assert.throws(() => finishPlan(repo, 'plan-1-test', undefined, { exclude: ['_docs/plans/plan-1-test'] }), /Cannot exclude the selected plan index/);
  git(repo, 'add', '--', existingDraftFile);
  assert.throws(() => finishPlan(repo, 'plan-1-test', undefined, { exclude: excluded }), /Excluded file is already staged/);
  assert.equal(git(repo, 'rev-parse', 'HEAD'), before);
  assert.equal(git(repo, 'diff', '--cached', '--name-only'), existingDraftFile);
  git(repo, 'reset', '--', existingDraftFile);

  const result = spawnSync(process.execPath, [
    join(process.cwd(), 'tools', 'harness', 'cli.mjs'), 'finish', '--plan', 'plan-1-test',
    ...excluded.flatMap((file) => ['--exclude', file]),
  ], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)), { plan: 'plan-1-test', committed: true, pushed: true });
  const publishedCatalog = JSON.parse(git(remote, 'show', 'dev:_docs/plans/index.json'));
  assert.deepEqual(publishedCatalog.plans, [catalog.plans[0], previousDraft]);
  for (const entry of publishedCatalog.plans) {
    assert.doesNotThrow(() => git(remote, 'show', `dev:_docs/plans/${entry.directory}/index.json`));
  }
  const committedFiles = git(repo, 'show', '--format=', '--name-only', 'HEAD');
  assert.match(committedFiles, /_docs\/plans\/index\.json/);
  assert.match(committedFiles, /included \[draft\]\.md/);
  assert.doesNotMatch(committedFiles, /plan-2-existing|plan-3-local|local notes/);
  assert.equal(readFileSync(catalogPath, 'utf8'), localCatalog);
  assert.equal(readFileSync(join(repo, existingDraftFile), 'utf8'), '# Local draft changes\n');
  assert.equal(readIndex(repo).plans.length, 3);
  assert.match(git(repo, 'status', '--short', '--untracked-files=all'), /plan-3-local\/index\.json/);
  assert.match(git(repo, 'status', '--short', '--untracked-files=all'), /local notes\.txt/);
  const publishedHead = git(repo, 'rev-parse', 'HEAD');
  assert.deepEqual(finishPlan(repo, 'plan-1-test', undefined, { exclude: excluded }), { plan: 'plan-1-test', committed: false, pushed: true });
  assert.equal(git(repo, 'rev-parse', 'HEAD'), publishedHead);
  assert.equal(readFileSync(catalogPath, 'utf8'), localCatalog);
});
