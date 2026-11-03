import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { readIndex, resetTask, startTask } from './cli.mjs';

const directories = [];
const hook = join(process.cwd(), '.codex', 'hooks', 'harness-hook.mjs');

function fixture() {
  const repo = mkdtempSync(join(tmpdir(), 'aivideo-hook-'));
  directories.push(repo);
  mkdirSync(join(repo, '_docs', 'plans', 'plan-1-hook'), { recursive: true });
  writeFileSync(join(repo, '_docs', 'plans', 'index.json'), `${JSON.stringify({
    version: 1,
    plans: [{ id: 'plan-1-hook', directory: 'plan-1-hook', title: 'Hook', status: 'draft' }],
  }, null, 2)}\n`);
  writeFileSync(join(repo, '_docs', 'plans', 'plan-1-hook', 'index.json'), `${JSON.stringify({
    version: 1,
    plan_id: 'plan-1-hook',
    tasks: [{
        id: 'task-1', name: 'Hook task', status: 'pending', depends_on: [],
        files: ['front/tests/unit/allowed.test.ts', 'back/test/unit/content/media-url.spec.ts'], checks: [],
      }],
  }, null, 2)}\n`);
  return repo;
}

function invoke(event, input) {
  const result = spawnSync(process.execPath, [hook, event], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

afterEach(() => {
  while (directories.length) rmSync(directories.pop(), { recursive: true, force: true });
});

test('user prompt hook ignores normal prompts and adds ready-task context for harness', () => {
  const repo = fixture();
  assert.deepEqual(invoke('user-prompt-submit', { cwd: repo, prompt: 'hello' }), {});
  const response = invoke('user-prompt-submit', { cwd: repo, prompt: '$harness' });
  assert.match(response.hookSpecificOutput.additionalContext, /task-1/);
});

test('file hook permits allowed tests and blocks source tests, web prototype, and out-of-scope active edits', () => {
  const repo = fixture();
  assert.deepEqual(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Add File: front/tests/unit/new.test.ts\n+test' } }), {});
  assert.deepEqual(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Add File: back/test/api/public.postman_collection.json\n+{}' } }), {});
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Add File: back/src/public.postman_collection.json\n+{}' } }).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Add File: front/src/new.test.ts\n+test' } }).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { input: '*** Add File: back/src/new.spec.ts\n+test' } }).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Update File: web-prototype/app.ts\n@@' } }).hookSpecificOutput.permissionDecision, 'deny');
  startTask(repo, 'plan-1-hook', 'task-1');
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Update File: AGENTS.md\n@@' } }).hookSpecificOutput.permissionDecision, 'deny');
});

test('file hook accepts in-repository absolute paths and rejects paths outside the repository', () => {
  const repo = fixture();
  startTask(repo, 'plan-1-hook', 'task-1');

  const allowed = join(repo, 'back', 'test', 'unit', 'content', 'media-url.spec.ts');
  assert.deepEqual(invoke('pre-file-write', { cwd: repo, tool_input: { patch: `*** Add File: ${allowed}\n+test` } }), {});
  assert.deepEqual(invoke('pre-file-write', { cwd: repo, tool_input: { patch: `*** Add File: ${allowed.replaceAll('\\', '/')}\n+test` } }), {});

  const outOfScope = join(repo, 'front', 'src', 'other.ts');
  assert.match(invoke('pre-file-write', { cwd: repo, tool_input: { patch: `*** Update File: ${outOfScope}\n@@` } }).hookSpecificOutput.permissionDecisionReason, /Active harness task does not declare front\/src\/other\.ts/);

  const outside = join(tmpdir(), 'outside.test.ts');
  assert.match(invoke('pre-file-write', { cwd: repo, tool_input: { patch: `*** Add File: ${outside}\n+test` } }).hookSpecificOutput.permissionDecisionReason, /Path must be repository-relative/);
});

test('bash hook blocks direct Git during an active task but permits the official finish command', () => {
  const repo = fixture();
  startTask(repo, 'plan-1-hook', 'task-1');
  assert.equal(invoke('pre-bash', { cwd: repo, tool_input: { command: 'git commit -m test' } }).hookSpecificOutput.permissionDecision, 'deny');
  assert.deepEqual(invoke('pre-bash', { cwd: repo, tool_input: { command: 'node tools/harness/cli.mjs finish --plan plan-1-hook' } }), {});
});

test('shell hook blocks development server launches with and without an active task', () => {
  const repo = fixture();
  const commands = [
    'npm --prefix back run start:dev', 'npm --prefix back run start:prod',
    'npm --prefix front run start -- --port 8081', 'npm start',
    'pnpm run dev', 'yarn start', 'npx nest start --watch', 'npx expo start',
    'node --enable-source-maps C:\\dh\\aivideo_av\\back\\dist\\main',
    'Get-Date; npm --prefix back run start:dev',
    'powershell -Command "npm --prefix back run start:dev"',
    'Start-Process -FilePath npm.cmd -ArgumentList @(\'--prefix\', \'back\', \'run\', \'start:dev\')',
  ];
  for (const active of [false, true]) {
    if (active) startTask(repo, 'plan-1-hook', 'task-1');
    for (const command of commands) {
      const response = invoke('pre-bash', { cwd: repo, tool_input: { command } });
      assert.equal(response.hookSpecificOutput?.permissionDecision, 'deny', command);
      assert.match(response.hookSpecificOutput.permissionDecisionReason, /started by the user/);
    }
  }
  assert.equal(invoke('pre-bash', { cwd: repo, tool_input: { cmd: 'nest start' } }).hookSpecificOutput.permissionDecision, 'deny');
});

test('shell hook inspects PowerShell helpers without executing them and permits checks and diagnostic text', () => {
  const repo = fixture();
  const launcher = join(repo, 'launch.ps1');
  writeFileSync(launcher, 'npm --prefix back run start:dev\n');
  assert.equal(invoke('pre-bash', { cwd: repo, tool_input: { command: `powershell -ExecutionPolicy Bypass -File "${launcher}"` } }).hookSpecificOutput.permissionDecision, 'deny');
  const safeScript = join(repo, 'inspect.ps1');
  writeFileSync(safeScript, 'Get-Process node\n');
  for (const command of [
    'npm --prefix back run test:api -- --suite watch-history',
    'npm --prefix front run test -- tests/unit/watchHistory.test.ts',
    'npm --prefix back run build', 'npm --prefix front run export',
    'curl.exe http://localhost:3000', 'Get-Process node',
    'Write-Output "npm start; nest start"',
    `Get-Content "${launcher}"`, `powershell -File "${safeScript}"`,
  ]) assert.deepEqual(invoke('pre-bash', { cwd: repo, tool_input: { command } }), {}, command);
});

test('worker hook records structured completion and failure, and holds malformed first stops', () => {
  const repo = fixture();
  startTask(repo, 'plan-1-hook', 'task-1');
  assert.equal(invoke('subagent-stop', { cwd: repo, last_assistant_message: '{"status":"completed","plan":"plan-1-hook","task":"task-1","summary":"done"}' }).systemMessage.includes('completed'), true);
  assert.equal(readIndex(repo).plans[0].tasks[0].status, 'completed');

  const second = fixture();
  startTask(second, 'plan-1-hook', 'task-1');
  const failure = invoke('subagent-stop', { cwd: second, last_assistant_message: '{"status":"error","plan":"plan-1-hook","task":"task-1","error":"failed"}' });
  assert.match(failure.systemMessage, /retry/);
  assert.equal(readIndex(second).plans[0].tasks[0].status, 'error');
  assert.equal(invoke('subagent-stop', { cwd: second, stop_hook_active: false, last_assistant_message: 'not json' }).decision, 'block');
  assert.match(invoke('subagent-stop', { cwd: second, stop_hook_active: true, last_assistant_message: 'not json' }).systemMessage, /malformed/);
});

test('worker hook blocks a task after three consecutive failures and reports the problem to the parent', () => {
  const repo = fixture();
  startTask(repo, 'plan-1-hook', 'task-1');
  const failure = JSON.stringify({ status: 'error', plan: 'plan-1-hook', task: 'task-1', error: 'check failed' });

  assert.match(invoke('subagent-stop', { cwd: repo, last_assistant_message: failure }).systemMessage, /recorded an error/);
  resetTask(repo, 'plan-1-hook', 'task-1');
  startTask(repo, 'plan-1-hook', 'task-1');
  assert.match(invoke('subagent-stop', { cwd: repo, last_assistant_message: failure }).systemMessage, /recorded an error/);
  resetTask(repo, 'plan-1-hook', 'task-1');
  startTask(repo, 'plan-1-hook', 'task-1');

  const final = invoke('subagent-stop', { cwd: repo, last_assistant_message: failure });
  assert.match(final.systemMessage, /blocked .* after 3 consecutive failures/);
  assert.equal(readIndex(repo).plans[0].tasks[0].status, 'blocked');
  assert.equal(readIndex(repo).plans[0].status, 'blocked');
});
