import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { readIndex, startTask } from './cli.mjs';

const directories = [];
const hook = join(process.cwd(), '.codex', 'hooks', 'harness-hook.mjs');

function fixture() {
  const repo = mkdtempSync(join(tmpdir(), 'aivideo-hook-'));
  directories.push(repo);
  mkdirSync(join(repo, '_docs', 'plans', 'plan-1-hook'), { recursive: true });
  writeFileSync(join(repo, '_docs', 'plans', 'index.json'), `${JSON.stringify({
    version: 1,
    plans: [{
      id: 'plan-1-hook', directory: 'plan-1-hook', title: 'Hook', status: 'draft', tasks: [{
        id: 'task-1', name: 'Hook task', status: 'pending', depends_on: [],
        files: ['front/tests/unit/allowed.test.ts'], checks: [],
      }],
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
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Add File: front/src/new.test.ts\n+test' } }).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { input: '*** Add File: back/src/new.spec.ts\n+test' } }).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Update File: web-prototype/app.ts\n@@' } }).hookSpecificOutput.permissionDecision, 'deny');
  startTask(repo, 'plan-1-hook', 'task-1');
  assert.equal(invoke('pre-file-write', { cwd: repo, tool_input: { patch: '*** Update File: AGENTS.md\n@@' } }).hookSpecificOutput.permissionDecision, 'deny');
});

test('bash hook blocks direct Git during an active task but permits the official finish command', () => {
  const repo = fixture();
  startTask(repo, 'plan-1-hook', 'task-1');
  assert.equal(invoke('pre-bash', { cwd: repo, tool_input: { command: 'git commit -m test' } }).hookSpecificOutput.permissionDecision, 'deny');
  assert.deepEqual(invoke('pre-bash', { cwd: repo, tool_input: { command: 'node tools/harness/cli.mjs finish --plan plan-1-hook' } }), {});
});

test('worker hook records structured completion and failure, and holds malformed first stops', () => {
  const repo = fixture();
  startTask(repo, 'plan-1-hook', 'task-1');
  assert.equal(invoke('subagent-stop', { cwd: repo, last_assistant_message: '{"status":"completed","plan":"plan-1-hook","task":"task-1","summary":"done"}' }).systemMessage.includes('completed'), true);
  assert.equal(readIndex(repo).plans[0].tasks[0].status, 'completed');

  const second = fixture();
  startTask(second, 'plan-1-hook', 'task-1');
  assert.equal(invoke('subagent-stop', { cwd: second, last_assistant_message: '{"status":"error","plan":"plan-1-hook","task":"task-1","error":"failed"}' }).systemMessage.includes('error'), true);
  assert.equal(readIndex(second).plans[0].tasks[0].status, 'error');
  assert.equal(invoke('subagent-stop', { cwd: second, stop_hook_active: false, last_assistant_message: 'not json' }).decision, 'block');
  assert.match(invoke('subagent-stop', { cwd: second, stop_hook_active: true, last_assistant_message: 'not json' }).systemMessage, /malformed/);
});
