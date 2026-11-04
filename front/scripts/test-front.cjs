const { existsSync, readdirSync, statSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join, resolve, relative, sep } = require('node:path');

function findTests(directory, projectRoot, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) findTests(path, projectRoot, files);
    else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
      files.push(relative(projectRoot, path).split(sep).join('/'));
    }
  }
  return files;
}

function resolveTests(args, projectRoot) {
  const testsRoot = resolve(projectRoot, 'tests');
  const selected = args.length === 0
    ? findTests(testsRoot, projectRoot)
    : args.map((argument) => {
      if (argument.startsWith('-')) throw new Error(`Unsupported test option: ${argument}`);
      const absolutePath = resolve(projectRoot, argument);
      const pathFromTests = relative(testsRoot, absolutePath);
      if (pathFromTests === '' || pathFromTests.startsWith(`..${sep}`) || pathFromTests === '..' || resolve(testsRoot, pathFromTests) !== absolutePath) {
        throw new Error(`Test file must be inside tests/: ${argument}`);
      }
      if (!/\.test\.tsx?$/.test(absolutePath) || !existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
        throw new Error(`Test file does not exist or is unsupported: ${argument}`);
      }
      return relative(projectRoot, absolutePath).split(sep).join('/');
    });
  const unique = [...new Set(selected)].sort();
  if (unique.length === 0) throw new Error('No test files found');
  return unique;
}

function run(testFiles, projectRoot) {
  const result = spawnSync(process.execPath, [
    require.resolve('jest/bin/jest'),
    '--config', join(projectRoot, 'jest.config.cjs'),
    '--runInBand', '--watch=false', '--watchAll=false',
    '--runTestsByPath', ...testFiles,
  ], { cwd: projectRoot, stdio: 'inherit' });
  return result.status ?? 1;
}

if (require.main === module) {
  try {
    const projectRoot = resolve(__dirname, '..');
    const selected = resolveTests(process.argv.slice(2), projectRoot);
    process.exitCode = run(selected, projectRoot);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { findTests, resolveTests, run };
