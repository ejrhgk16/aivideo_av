const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, relative, sep } = require('node:path');
const { spawnSync } = require('node:child_process');

const output = mkdtempSync(join(tmpdir(), 'aivideo-tests-'));
try {
  const build = spawnSync(process.execPath, [
    require.resolve('typescript/bin/tsc'), '--ignoreConfig', '--module', 'commonjs',
    '--target', 'es2022', '--types', 'node', '--skipLibCheck', '--esModuleInterop',
    '--strict', '--outDir', output, 'src/features/drama/experience.test.ts',
  ], { cwd: resolve(__dirname, '..'), stdio: 'inherit' });
  if (build.status !== 0) process.exitCode = build.status ?? 1;
  else {
    const test = spawnSync(process.execPath, ['--test', join(output, 'experience.test.js')], { stdio: 'inherit' });
    process.exitCode = test.status ?? 1;
  }
} finally {
  const outputName = relative(tmpdir(), output);
  if (!outputName.startsWith('aivideo-tests-') || outputName.includes(sep)) {
    throw new Error('Unexpected temporary test directory');
  }
  rmSync(output, { recursive: true, force: true });
}
