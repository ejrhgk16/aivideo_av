# task-1-front-test-selection

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-44-scoped-parallel-tests/index.json
- _docs/plans/plan-45-saved-video-review-fixes/index.json
- front/package.json
- front/scripts/test-front.cjs
- front/tests/unit/media.test.ts
- front/tests/unit/savedVideos.test.ts
- front/README.md

## 작업

프론트 테스트 실행기에 정확한 테스트 파일 선택을 추가한다. task-2와 병렬 작업할 수 있다. 다른 작업자의 변경을 되돌리지 않고 다음 세 파일만 apply_patch로 수정한다. plan-45의 충돌 작업이 완료된 최신 실행기를 기준으로 변경한다.

### 변경 허용 파일

~~~text
front/scripts/test-front.cjs
front/tests/unit/testFrontRunner.test.ts
front/README.md
~~~

### 실행 계약

- npm --prefix front run test -- tests/unit/savedVideos.test.ts 는 해당 파일만 컴파일 진입점·Node test runner 대상에 넣는다. 의존 소스는 컴파일할 수 있지만 다른 테스트 파일을 실행하지 않는다.
- 여러 정확한 파일을 받을 수 있고 중복 지정은 한 번만 실행한다. front 작업 디렉터리에서도 같은 경로 계약을 사용한다.
- 인자 없으면 front/tests/ 아래 모든 .test.ts/.test.tsx를 발견·정렬해 실행한다. 고정 배열에 테스트를 매번 등록하는 구조를 제거한다. 선택 인자를 glob·이름 패턴으로 확대하지 않는다.
- 정규화한 경로가 front/tests/ 안의 실제 테스트 파일인지 검사한다. 경로 탈출, 다른 루트·소스 파일, 존재하지 않는 파일, 지원하지 않는 옵션, 빈 전체 발견 결과는 비정상 종료다. 잘못된 인자를 무인자 전체 실행으로 바꾸지 않는다.
- 현재 TypeScript 옵션·Node test runner를 유지한다. 실행별 mkdtempSync 출력과 finally cleanup을 유지하고 .test.tsx도 올바른 JS 출력 경로로 실행한다.
- 제품 소스·package.json·새 의존성은 변경하지 않는다. Expo 런타임 코드를 추가하지 않는다.

### 주요 로직 코드 또는 변경 예시

선택 결과를 컴파일과 실행 양쪽에 동일하게 전달한다. resolveTests는 파일 발견·경계 검사·중복 제거를 같은 실행기 안에서 처리한다. 별도 범용 실행 계층을 추가하지 않는다.

~~~js
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
    const compiledTests = testFiles.map(file => join(output, file.replace(/\.tsx?$/, '.js')));
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
~~~

테스트가 함수를 사용할 필요가 있으면 같은 CJS 파일에서 export하되 import만으로 실행하지 않게 한다. subprocess 선택 실행은 신규 runner 테스트 자신을 재실행하지 않고 기존 media.test.ts 등을 사용해 재귀를 피한다.

### 테스트와 문서

- testFrontRunner.test.ts에서 한 파일, 복수·중복 파일, 무인자 전체 발견, 잘못된 경로·빈 발견의 실패를 검사한다.
- 작은 임시 테스트 파일로 선택하지 않은 실패 테스트가 실행되지 않음을 검증해도 된다. 테스트용 파일은 OS 임시 폴더에서 만들고 정리한다.
- 기존 테스트 하나의 실제 subprocess 선택 실행을 포함한다. 로그 문구나 구현 정규식 검사만으로 대체하지 않는다.
- 병렬 두 실행에서 출력·cleanup이 서로 간섭하지 않는지 확인한다.
- front/README.md에 전체 실행과 파일 선택 명령을 추가한다. 무관한 미디어·인증 설명은 변경하지 않는다.

### 검증 명령

~~~text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
~~~

### 완료 조건

선택 파일만 실행되고 무인자 전체 실행에 신규 runner 테스트도 포함된다. 잘못된 선택은 실패하고 출력·정리가 실행별로 격리된다. 세 checks가 통과하며 worker 결과에 선택·전체 실행 검증을 요약한다.
