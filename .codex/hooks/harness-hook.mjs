import { readFileSync } from 'node:fs';
import { completeTask, failTask, getHarnessStatus, getNext, isAllowedTestPath, normalizePath, readIndex } from '../../tools/harness/cli.mjs';

const TEST_FILE = /(?:\.test\.(?:ts|tsx|mjs)|\.spec\.ts)$/;

function output(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function readInput() {
  const raw = readFileSync(0, 'utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function repositoryRoot(input) {
  return input.cwd || process.cwd();
}

function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

function hookContext(repoRoot) {
  const status = getHarnessStatus(repoRoot);
  const active = status.plans.filter((plan) => plan.status !== 'completed');
  if (active.length !== 1) return 'Harness: no unambiguous active plan. Run `node tools/harness/cli.mjs status`.';
  const next = getNext(repoRoot, active[0].id);
  const task = next.task ? ` Next task: ${next.task.id} (${next.task.files.join(', ')}).` : '';
  return `Harness plan ${next.plan} is ${next.state}.${task}`;
}

function patchPaths(value) {
  if (typeof value !== 'string') return [];
  const paths = [];
  const patterns = [
    /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm,
    /^\*\*\* Move to: (.+)$/gm,
    /^(?:--- a\/|\+\+\+ b\/)(.+)$/gm,
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      if (match[1] !== '/dev/null') paths.push(match[1].trim());
    }
  }
  return paths;
}

function nestedPatchPaths(value) {
  if (typeof value === 'string') return patchPaths(value);
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(nestedPatchPaths);
}

function filePaths(input) {
  const toolInput = input.tool_input ?? input.toolInput ?? {};
  if (typeof toolInput === 'string') return patchPaths(toolInput);
  const paths = [toolInput.path, toolInput.file_path, toolInput.filename, input.path, input.file_path].filter(Boolean);
  paths.push(...nestedPatchPaths(toolInput));
  return [...new Set(paths)];
}

function activeScope(repoRoot) {
  const index = readIndex(repoRoot);
  const active = index.plans.flatMap((plan) => plan.tasks
    .filter((task) => task.status === 'in_progress')
    .map((task) => ({ plan, task })));
  return {
    active,
    allowed: new Set([
      '_docs/plans/index.json',
      ...active.flatMap(({ plan, task }) => [
        ...task.files,
        `_docs/plans/${plan.directory}/`,
      ]),
    ]),
  };
}

function isInScope(file, allowed) {
  return allowed.has(file) || [...allowed].some((entry) => entry.endsWith('/') && file.startsWith(entry));
}

function preFileWrite(input) {
  const repoRoot = repositoryRoot(input);
  let paths;
  try {
    paths = filePaths(input).map(normalizePath);
  } catch (cause) {
    return deny(cause.message);
  }
  for (const file of paths) {
    if (file === 'web-prototype' || file.startsWith('web-prototype/')) return deny('web-prototype is outside harness scope');
    if (TEST_FILE.test(file) && !isAllowedTestPath(file)) return deny(`Test files must live in front/tests/, back/test/, or tools/harness/: ${file}`);
  }
  try {
    const { active, allowed } = activeScope(repoRoot);
    const outside = paths.find((file) => active.length > 0 && !isInScope(file, allowed));
    if (outside) return deny(`Active harness task does not declare ${outside}`);
  } catch (cause) {
    return deny(`Cannot verify harness scope: ${cause.message}`);
  }
  return {};
}

function preBash(input) {
  const repoRoot = repositoryRoot(input);
  const command = input.tool_input?.command ?? input.command ?? '';
  let active;
  try {
    active = activeScope(repoRoot).active.length > 0;
  } catch (cause) {
    return deny(`Cannot verify harness scope: ${cause.message}`);
  }
  if (!active) return {};
  const officialFinish = /^\s*(?:node(?:\.exe)?\s+)?(?:\.\/)?tools[\\/]harness[\\/]cli\.mjs\s+finish(?:\s+--[\w-]+\s+[^\s]+)*\s*$/.test(command);
  const directGit = /\bgit\s+(?:commit|push|checkout|switch|merge|rebase|reset)\b/i.test(command);
  if (directGit && !officialFinish) return deny('Use `node tools/harness/cli.mjs finish` after all tasks complete; direct Git operations are blocked during a harness task');
  return {};
}

function parseWorkerResult(message) {
  if (typeof message !== 'string') return undefined;
  try {
    const result = JSON.parse(message.trim());
    if (!['completed', 'error'].includes(result.status) || typeof result.plan !== 'string' || typeof result.task !== 'string') return undefined;
    if (result.status === 'completed' && typeof result.summary === 'string' && result.summary) return result;
    if (result.status === 'error' && typeof result.error === 'string' && result.error) return result;
  } catch {
    return undefined;
  }
  return undefined;
}

function subagentStop(input) {
  const result = parseWorkerResult(input.last_assistant_message);
  if (!result) {
    if (!input.stop_hook_active) return { decision: 'block', reason: 'Return exactly one harness worker JSON result before stopping.' };
    return { systemMessage: 'Harness worker result was malformed; parent must mark the task failed with the harness CLI.' };
  }
  try {
    const repoRoot = repositoryRoot(input);
    if (result.status === 'completed') completeTask(repoRoot, result.plan, result.task, result.summary);
    else failTask(repoRoot, result.plan, result.task, result.error);
    return { systemMessage: `Harness recorded ${result.status} for ${result.plan}/${result.task}.` };
  } catch (cause) {
    return { systemMessage: `Harness could not record worker result: ${cause.message}` };
  }
}

function main() {
  const [event] = process.argv.slice(2);
  const input = readInput();
  if (event === 'user-prompt-submit') {
    const prompt = input.prompt?.trim() ?? '';
    if (!/^\$(?:harness|finish-plan)(?:\s|$)/.test(prompt)) return output({});
    try {
      return output({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: hookContext(repositoryRoot(input)) } });
    } catch (cause) {
      return output({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `Harness state unavailable: ${cause.message}` } });
    }
  }
  if (event === 'pre-file-write') return output(preFileWrite(input));
  if (event === 'pre-bash') return output(preBash(input));
  if (event === 'subagent-stop') return output(subagentStop(input));
  return output({});
}

main();
