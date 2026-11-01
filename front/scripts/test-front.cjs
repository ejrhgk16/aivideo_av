const { existsSync, mkdtempSync, readdirSync, rmSync, statSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, relative, sep } = require('node:path');
const { spawnSync } = require('node:child_process');

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
  const output = mkdtempSync(join(tmpdir(), 'aivideo-tests-'));
  try {
    const build = spawnSync(process.execPath, [
      require.resolve('typescript/bin/tsc'), '--ignoreConfig', '--module', 'commonjs',
      '--target', 'es2022', '--jsx', 'react-jsx', '--types', 'node', '--skipLibCheck',
      '--esModuleInterop', '--strict', '--rootDir', '.', '--outDir', output,
      ...testFiles,
    ], { cwd: projectRoot, stdio: 'inherit' });
    if (build.status !== 0) return build.status ?? 1;
    const compiledTests = testFiles.map((file) => join(output, file.replace(/\.tsx?$/, '.js')));
    const test = spawnSync(process.execPath, ['--test', ...compiledTests], {
      cwd: projectRoot, stdio: 'inherit',
    });
    return test.status ?? 1;
  } finally {
    const outputName = relative(tmpdir(), output);
    if (!outputName.startsWith('aivideo-tests-') || outputName.includes(sep)) {
      throw new Error('Unexpected temporary test directory');
    }
    rmSync(output, { recursive: true, force: true });
  }
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

module.exports = { resolveTests, run };
