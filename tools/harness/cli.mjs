import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PLANS_INDEX = '_docs/plans/index.json';
const TEST_FILE = /(?:\.test\.(?:ts|tsx|mjs)|\.spec\.ts)$/;
const ALLOWED_TEST_FILE = [
  /^front\/tests\/.+\.test\.(?:ts|tsx)$/,
  /^back\/test\/unit\/.+\.spec\.ts$/,
  /^tools\/harness\/.+\.test\.mjs$/,
];
const TASK_STATUS = new Set(['pending', 'in_progress', 'completed', 'error', 'blocked']);
const PLAN_STATUS = new Set(['draft', 'active', 'completed', 'error', 'blocked']);
const MAX_FAILURES = 3;

function error(message) {
  throw new Error(message);
}

function asString(value, label) {
  if (typeof value !== 'string' || value.length === 0) error(`${label} must be a non-empty string`);
  return value;
}

export function normalizePath(value) {
  const normalized = String(value).replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized.startsWith('/') || normalized.startsWith('../') || normalized.includes('/../')) {
    error(`Path must be repository-relative: ${value}`);
  }
  return normalized;
}

export function isAllowedTestPath(file) {
  return ALLOWED_TEST_FILE.some((pattern) => pattern.test(file));
}

export function validatePlansIndex(index) {
  if (!index || index.version !== 1 || !Array.isArray(index.plans)) error('Plan index must contain version 1 and a plans array');
  const planIds = new Set();

  for (const plan of index.plans) {
    asString(plan?.id, 'Plan id');
    if (planIds.has(plan.id)) error(`Duplicate plan id: ${plan.id}`);
    planIds.add(plan.id);
    if (!PLAN_STATUS.has(plan.status)) error(`Invalid plan status for ${plan.id}: ${plan.status}`);
    if (!/^plan-\d+-[a-z0-9][a-z0-9-]*$/.test(plan.directory ?? '')) error(`Invalid plan directory for ${plan.id}`);
    if (Object.hasOwn(plan, 'tasks')) error(`Plan ${plan.id} tasks must be stored in its plan index`);
  }
  return index;
}

function validateTasks(plan, tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) error(`Plan ${plan.id} must have at least one task`);

    const taskIds = new Set();
    for (const task of tasks) {
      asString(task?.id, `Task id in ${plan.id}`);
      if (taskIds.has(task.id)) error(`Duplicate task id in ${plan.id}: ${task.id}`);
      taskIds.add(task.id);
      asString(task.name, `Task ${task.id} name`);
      if (!TASK_STATUS.has(task.status)) error(`Invalid status for ${plan.id}/${task.id}: ${task.status}`);
      if (!Array.isArray(task.depends_on) || !Array.isArray(task.files) || !Array.isArray(task.checks)) {
        error(`Task ${plan.id}/${task.id} must define depends_on, files, and checks arrays`);
      }
      if (task.files.length === 0) error(`Task ${plan.id}/${task.id} must declare files`);
      for (const file of task.files) {
        const normalized = normalizePath(file);
        if (normalized !== file) error(`Task ${plan.id}/${task.id} file must use forward-slash relative paths: ${file}`);
        if (normalized === 'web-prototype' || normalized.startsWith('web-prototype/')) error(`web-prototype is outside harness scope: ${file}`);
        if (TEST_FILE.test(normalized) && !isAllowedTestPath(normalized)) error(`Test file is outside the approved location: ${file}`);
      }
      for (const check of task.checks) asString(check, `Check for ${plan.id}/${task.id}`);
    }

    const byId = new Map(tasks.map((task) => [task.id, task]));
    for (const task of tasks) {
      for (const dependency of task.depends_on) {
        if (!byId.has(dependency)) error(`Task ${plan.id}/${task.id} depends on unknown task: ${dependency}`);
        if (dependency === task.id) error(`Task ${plan.id}/${task.id} cannot depend on itself`);
      }
    }

    const visiting = new Set();
    const visited = new Set();
    const visit = (taskId) => {
      if (visiting.has(taskId)) error(`Dependency cycle in ${plan.id} at ${taskId}`);
      if (visited.has(taskId)) return;
      visiting.add(taskId);
      for (const dependency of byId.get(taskId).depends_on) visit(dependency);
      visiting.delete(taskId);
      visited.add(taskId);
    };
    for (const task of tasks) visit(task.id);

    const dependsOn = (fromId, targetId, seen = new Set()) => {
      if (seen.has(fromId)) return false;
      seen.add(fromId);
      const task = byId.get(fromId);
      return task.depends_on.some((dependency) => dependency === targetId || dependsOn(dependency, targetId, seen));
    };
    for (let left = 0; left < tasks.length; left += 1) {
      for (let right = left + 1; right < tasks.length; right += 1) {
        const first = tasks[left];
        const second = tasks[right];
        const overlap = first.files.find((file) => second.files.includes(file));
        if (overlap && !dependsOn(first.id, second.id) && !dependsOn(second.id, first.id)) {
          error(`Potentially parallel tasks ${plan.id}/${first.id} and ${second.id} share ${overlap}`);
        }
      }
    }
}

export function validatePlanIndex(plan, planIndex) {
  if (!planIndex || planIndex.version !== 1 || planIndex.plan_id !== plan.id || !Array.isArray(planIndex.tasks)) {
    error(`Plan task index must contain version 1, plan_id ${plan.id}, and a tasks array`);
  }
  validateTasks(plan, planIndex.tasks);
  return planIndex;
}

export function validateIndex(index) {
  validatePlansIndex({ version: index?.version, plans: index?.plans?.map(({ tasks, ...plan }) => plan) });
  for (const plan of index.plans) validateTasks(plan, plan.tasks);
  return index;
}

function readJson(path, label) {
  if (!existsSync(path)) error(`Missing ${label}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    if (cause instanceof SyntaxError) error(`Invalid JSON in ${label}`);
    throw cause;
  }
}

function planIndexPath(repoRoot, plan) {
  return resolve(repoRoot, '_docs', 'plans', plan.directory, 'index.json');
}

export function readIndex(repoRoot = process.cwd()) {
  const path = resolve(repoRoot, PLANS_INDEX);
  const index = readJson(path, PLANS_INDEX);
  validatePlansIndex(index);
  const plans = index.plans.map((plan) => {
    const planIndex = readJson(planIndexPath(repoRoot, plan), `_docs/plans/${plan.directory}/index.json`);
    validatePlanIndex(plan, planIndex);
    return { ...plan, tasks: planIndex.tasks };
  });
  return validateIndex({ ...index, plans });
}

function writeIndexes(repoRoot, index, planId) {
  const plans = index.plans.map(({ tasks, ...plan }) => plan);
  writeFileSync(resolve(repoRoot, PLANS_INDEX), `${JSON.stringify({ ...index, plans }, null, 2)}\n`);
  const plan = index.plans.find((item) => item.id === planId);
  writeFileSync(planIndexPath(repoRoot, plan), `${JSON.stringify({ version: 1, plan_id: plan.id, tasks: plan.tasks }, null, 2)}\n`);
}

function lockPath(repoRoot) {
  return resolve(repoRoot, '_docs/plans/.harness.lock');
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function withIndexLock(repoRoot, action) {
  const path = lockPath(repoRoot);
  mkdirSync(dirname(path), { recursive: true });
  const deadline = Date.now() + 5000;
  let descriptor;
  while (!descriptor) {
    try {
      descriptor = openSync(path, 'wx');
    } catch (cause) {
      if (cause?.code !== 'EEXIST' || Date.now() >= deadline) error('Harness state is locked by another worker');
      sleep(25);
    }
  }
  try {
    return action();
  } finally {
    rmSync(path, { force: true });
  }
}

function selectPlan(index, planId) {
  if (planId) {
    const plan = index.plans.find((item) => item.id === planId);
    if (!plan) error(`Unknown plan: ${planId}`);
    return plan;
  }
  const candidates = index.plans.filter((plan) => plan.status !== 'completed');
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0 && index.plans.length === 1) return index.plans[0];
  error('Specify --plan when the plan is ambiguous');
}

function selectTask(plan, taskId) {
  if (!taskId) error('Specify --task');
  const task = plan.tasks.find((item) => item.id === taskId);
  if (!task) error(`Unknown task: ${plan.id}/${taskId}`);
  return task;
}

export function nextForPlan(plan) {
  if (plan.tasks.some((task) => task.status === 'blocked')) return { state: 'blocked' };
  if (plan.tasks.some((task) => task.status === 'error')) return { state: 'error' };
  const ready = plan.tasks.find((task) => task.status === 'pending' && task.depends_on.every((id) => plan.tasks.find((item) => item.id === id).status === 'completed'));
  if (ready) return { state: 'delegate', task: ready };
  if (plan.tasks.every((task) => task.status === 'completed')) return { state: 'done' };
  return { state: 'wait' };
}

function refreshPlanStatus(plan) {
  if (plan.tasks.some((task) => task.status === 'blocked')) plan.status = 'blocked';
  else if (plan.tasks.some((task) => task.status === 'error')) plan.status = 'error';
  else if (plan.tasks.every((task) => task.status === 'completed')) plan.status = 'completed';
  else plan.status = 'active';
}

function mutatePlan(repoRoot, planId, action) {
  return withIndexLock(repoRoot, () => {
    const index = readIndex(repoRoot);
    const plan = selectPlan(index, planId);
    const result = action(plan);
    refreshPlanStatus(plan);
    writeIndexes(repoRoot, index, plan.id);
    return { plan, result };
  });
}

export function startTask(repoRoot, planId, taskId) {
  const { plan, result: task } = mutatePlan(repoRoot, planId, (plan) => {
    if (['error', 'blocked'].includes(nextForPlan(plan).state)) error(`Plan ${plan.id} has a failed task; reset it before dispatching more work`);
    const task = selectTask(plan, taskId);
    if (task.status !== 'pending') error(`Task ${plan.id}/${task.id} is not pending`);
    if (!task.depends_on.every((id) => selectTask(plan, id).status === 'completed')) error(`Task ${plan.id}/${task.id} is not ready`);
    task.status = 'in_progress';
    task.started_at = new Date().toISOString();
    delete task.completed_at;
    delete task.error;
    return task;
  });
  return { plan: plan.id, task: task.id, status: task.status };
}

export function completeTask(repoRoot, planId, taskId, summary) {
  const { plan, result: task } = mutatePlan(repoRoot, planId, (plan) => {
    const task = selectTask(plan, taskId);
    if (task.status !== 'in_progress') error(`Task ${plan.id}/${task.id} is not in progress`);
    task.status = 'completed';
    task.summary = asString(summary, 'Completion summary');
    task.completed_at = new Date().toISOString();
    delete task.error;
    delete task.failure_count;
    delete task.test_failure_count;
    return task;
  });
  return { plan: plan.id, task: task.id, status: task.status };
}

export function failTask(repoRoot, planId, taskId, failure, options = {}) {
  const { plan, result: task } = mutatePlan(repoRoot, planId, (plan) => {
    const task = selectTask(plan, taskId);
    if (task.status !== 'in_progress') error(`Task ${plan.id}/${task.id} is not in progress`);
    const summary = asString(failure, 'Failure summary');
    task.failure_count = (task.failure_count ?? 0) + 1;
    if (options.failureType === 'test') {
      task.test_failure_count = (task.test_failure_count ?? 0) + 1;
      task.status = task.failure_count >= MAX_FAILURES ? 'blocked' : 'error';
      task.error = task.status === 'blocked'
        ? `Task failed ${task.failure_count} consecutive times: ${summary}`
        : summary;
    } else {
      task.status = task.failure_count >= MAX_FAILURES ? 'blocked' : 'error';
      task.error = task.status === 'blocked'
        ? `Task failed ${task.failure_count} consecutive times: ${summary}`
        : summary;
    }
    task.completed_at = new Date().toISOString();
    return task;
  });
  return {
    plan: plan.id,
    task: task.id,
    status: task.status,
    failureCount: task.failure_count ?? 0,
    testFailureCount: task.test_failure_count ?? 0,
  };
}

export function retryTask(repoRoot, planId, taskId) {
  const { plan, result: task } = mutatePlan(repoRoot, planId, (plan) => {
    const task = selectTask(plan, taskId);
    if (task.status !== 'error') error(`Task ${plan.id}/${task.id} is not retryable`);
    task.status = 'in_progress';
    task.started_at = new Date().toISOString();
    delete task.completed_at;
    delete task.error;
    return task;
  });
  return { plan: plan.id, task: task.id, status: task.status, failureCount: task.failure_count ?? 0 };
}

export function resetTask(repoRoot, planId, taskId) {
  const { plan, result: task } = mutatePlan(repoRoot, planId, (plan) => {
    const task = selectTask(plan, taskId);
    if (task.status === 'pending') error(`Task ${plan.id}/${task.id} is already pending`);
    const progressedDependent = plan.tasks.find((candidate) => candidate.depends_on.includes(task.id) && candidate.status !== 'pending');
    if (progressedDependent) error(`Reset ${progressedDependent.id} before resetting its dependency ${task.id}`);
    const wasBlocked = task.status === 'blocked';
    task.status = 'pending';
    delete task.started_at;
    delete task.completed_at;
    delete task.summary;
    delete task.error;
    if (wasBlocked) {
      delete task.failure_count;
      delete task.test_failure_count;
    }
    return task;
  });
  return { plan: plan.id, task: task.id, status: task.status };
}

export function getHarnessStatus(repoRoot = process.cwd(), planId) {
  const index = readIndex(repoRoot);
  if (!planId) {
    return {
      plans: index.plans.map((plan) => ({
        id: plan.id,
        status: plan.status,
        tasks: plan.tasks.map((task) => ({ id: task.id, status: task.status })),
      })),
    };
  }
  const plan = selectPlan(index, planId);
  return { plan: plan.id, status: plan.status, tasks: plan.tasks.map(({ id, name, status, depends_on }) => ({ id, name, status, depends_on })) };
}

export function getNext(repoRoot = process.cwd(), planId) {
  const plan = selectPlan(readIndex(repoRoot), planId);
  const next = nextForPlan(plan);
  return { plan: plan.id, state: next.state, task: next.task ? { id: next.task.id, name: next.task.name, files: next.task.files, checks: next.task.checks } : undefined };
}

function git(repoRoot, args, options = {}) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', ...options });
  if (result.status !== 0) error(result.stderr?.trim() || `git ${args.join(' ')} failed`);
  return result.stdout ?? '';
}

function dirtyPaths(repoRoot) {
  const raw = git(repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (!raw) return [];
  const records = raw.split('\0');
  const paths = [];
  for (let index = 0; index < records.length - 1; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    paths.push(normalizePath(record.slice(3)));
    if (status.includes('R') || status.includes('C')) paths.push(normalizePath(records[++index]));
  }
  return paths;
}

function isCurrentDev(repoRoot) {
  return git(repoRoot, ['branch', '--show-current']).trim() === 'dev';
}

function isProductPath(file) {
  return file.startsWith('front/') || file.startsWith('back/');
}

function runCheck(repoRoot, command) {
  const result = spawnSync(command, { cwd: repoRoot, shell: true, stdio: 'inherit' });
  if (result.status !== 0) error(`Check failed: ${command}`);
}

export function finishPlan(repoRoot = process.cwd(), planId, message) {
  if (!isCurrentDev(repoRoot)) error('finish must run on the dev branch');
  const index = readIndex(repoRoot);
  const plan = selectPlan(index, planId);
  if (!plan.tasks.every((task) => task.status === 'completed')) error(`Plan ${plan.id} is not complete`);

  const dirty = dirtyPaths(repoRoot);

  const changedFront = dirty.some((file) => file.startsWith('front/'));
  const changedBack = dirty.some((file) => file.startsWith('back/'));
  const checks = new Set(plan.tasks
    .filter((task) => task.files.some(isProductPath))
    .flatMap((task) => task.checks));
  if (changedFront) ['npm --prefix front run typecheck', 'npm --prefix front run test', 'npm --prefix front run export'].forEach((check) => checks.add(check));
  if (changedBack) ['npm --prefix back run lint', 'npm --prefix back run test', 'npm --prefix back run build'].forEach((check) => checks.add(check));
  for (const check of checks) runCheck(repoRoot, check);

  if (dirty.length > 0) {
    git(repoRoot, ['add', '--all']);
    git(repoRoot, ['commit', '-m', message || `chore(harness): finish ${plan.id}`], { stdio: 'inherit' });
  }
  git(repoRoot, ['push', 'origin', 'dev'], { stdio: 'inherit' });
  return { plan: plan.id, committed: dirty.length > 0, pushed: true };
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith('--')) error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    const value = rest[++index];
    if (!value || value.startsWith('--')) error(`Missing value for --${key}`);
    options[key] = value;
  }
  return { command, options };
}

export function main(argv = process.argv.slice(2), repoRoot = process.cwd()) {
  const { command, options } = parseArguments(argv);
  let result;
  switch (command) {
    case 'validate': result = { valid: true, plans: readIndex(repoRoot).plans.map((plan) => plan.id) }; break;
    case 'status': result = getHarnessStatus(repoRoot, options.plan); break;
    case 'next': result = getNext(repoRoot, options.plan); break;
    case 'start': result = startTask(repoRoot, options.plan, options.task); break;
    case 'complete': result = completeTask(repoRoot, options.plan, options.task, options.summary); break;
    case 'fail': result = failTask(repoRoot, options.plan, options.task, options.error); break;
    case 'retry': result = retryTask(repoRoot, options.plan, options.task); break;
    case 'reset': result = resetTask(repoRoot, options.plan, options.task); break;
    case 'finish': result = finishPlan(repoRoot, options.plan, options.message); break;
    default: error('Usage: cli.mjs <validate|status|next|start|complete|fail|retry|reset|finish> [--plan ID] [--task ID]');
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (cause) {
    process.stderr.write(`Harness error: ${cause.message}\n`);
    process.exitCode = 1;
  }
}
