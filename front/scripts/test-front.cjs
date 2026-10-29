const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, relative, sep } = require('node:path');
const { spawnSync } = require('node:child_process');

const output = mkdtempSync(join(tmpdir(), 'aivideo-tests-'));
const testFiles = ['tests/unit/media.test.ts', 'tests/unit/homeContent.test.ts', 'tests/unit/dramaContent.test.ts', 'tests/unit/dramaDetailScreen.test.ts', 'tests/unit/login.test.ts', 'tests/unit/session.test.ts', 'tests/unit/api.test.ts', 'tests/unit/errorMessages.test.ts', 'tests/unit/episodePlayback.test.ts', 'tests/unit/previewPlayback.test.ts', 'tests/unit/episodePurchase.test.ts', 'tests/unit/episodeUnlockDialog.test.ts', 'tests/unit/watchProgress.test.ts', 'tests/unit/playbackScreenEpisode.test.ts', 'tests/unit/recommendationPreviewBuffer.test.ts', 'tests/unit/sessionExpiredDialog.test.ts'];
try {
  const build = spawnSync(process.execPath, [
    require.resolve('typescript/bin/tsc'), '--ignoreConfig', '--module', 'commonjs',
    '--target', 'es2022', '--jsx', 'react-jsx', '--types', 'node', '--skipLibCheck', '--esModuleInterop',
    '--strict', '--rootDir', '.', '--outDir', output, ...testFiles,
  ], { cwd: resolve(__dirname, '..'), stdio: 'inherit' });
  if (build.status !== 0) process.exitCode = build.status ?? 1;
  else {
    const test = spawnSync(process.execPath, ['--test', ...testFiles.map(file => join(output, file.replace(/\.ts$/, '.js')))], { cwd: resolve(__dirname, '..'), stdio: 'inherit' });
    process.exitCode = test.status ?? 1;
  }
} finally {
  const outputName = relative(tmpdir(), output);
  if (!outputName.startsWith('aivideo-tests-') || outputName.includes(sep)) {
    throw new Error('Unexpected temporary test directory');
  }
  rmSync(output, { recursive: true, force: true });
}
