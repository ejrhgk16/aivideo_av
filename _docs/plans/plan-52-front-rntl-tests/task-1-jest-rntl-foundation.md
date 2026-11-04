# task-1-jest-rntl-foundation

## 기본 입력

- 이 task 문서와 index.json의 task-1 항목.
- 컨텍스트로 전달된 루트·front 적용 지침과 필요한 선행 task 완료 요약. 다른 작업자가 함께 작업하므로 다른 task의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- front/package.json, front/package-lock.json, front/tsconfig.json의 현재 의존성과 test/typecheck 스크립트.
- front/scripts/test-front.cjs 전체 및 front/tests/unit/testFrontRunner.test.ts, front/tests/unit/media.test.ts의 기존 선택/동시 실행/환경변수 시나리오.
- front/src/common/media.ts의 함수 계약만 읽는다.
- front/node_modules/expo/bundledNativeModules.json의 jest-expo 항목, expo-router/package.json 및 build/testing-library/index.js의 RNTL 사용 구간.
- front/src/screens/playbackScreen_episode.tsx, playbackScreen_preview.tsx, RecommendationScreen.tsx의 expo-video import·player 필드·addListener 사용 구간만 읽는다.
- 신규 담당 파일 front/jest.config.cjs, front/tests/setup.ts, front/tests/support/video.ts는 아래 계약으로 작성한다.

## 필요 시 참고할 문서

- 전달된 적용 지침이 누락되었거나 변경되었을 때만 AGENTS.md와 front/AGENTS.md의 테스트·셸 규칙을 확인한다.
- 테스트 지원 코드와 제품 코드의 책임 경계가 불명확할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Boundaries를 확인한다.
- 이 task 계약에 누락·충돌이 있을 때만 plan.md의 승인된 계약 및 기능별 검증 대응을 확인하고 보고한다. 전체 plan 재독을 요구하지 않는다.

## 실패 시 참고할 파일

- 정적 문법 오류 시 담당 config/launcher만 확인한다. 실제 Jest 기능 실패 분석은 task-7에서 이 task에 전달한다.

## 작업

현재 경로 선택 계약을 보존하며 표준 Jest/RNTL 기반과 공통 네이티브 영상 경계를 작성한다.

### 역할과 완료 조건

테스트·필요 실행기 작성 역할이다. 제품 src는 수정하지 않는다. 의존성·설정·helper·runner/media 테스트를 작성하고 선언된 node --check 두 개와 시나리오 검토만 수행한다. npm test 또는 컴포넌트 실행·기대 실패 확인은 하지 않는다. 작성 완료는 테스트 통과가 아니며 task-7이 선택·무인자 실행을 검증한다.

### 구현 계약

- devDependencies 기준: jest 29.7.0, @types/jest 29.5.14, jest-expo ~57.0.5, @react-native/jest-preset 0.86.3, @testing-library/react-native 13.3.3, react-test-renderer 19.2.3, jest-environment-jsdom 29.7.0. lockfile을 선언과 맞추고 기존 앱 의존성 버전을 변경하지 않는다. 설치는 잠금 파일과 일치시킨다.
- tsconfig에는 필요한 Jest/Node 타입을 선언하되 기존 Expo 설정·@/ alias·제품 타입 검사 범위는 유지한다. Jest는 Babel 변환을 하므로 별도 typecheck를 대체하지 않는다.
- jest.config.cjs는 jest-expo preset, tests 한정 .test.ts/.test.tsx 발견, @/ → src alias, tests/setup.ts를 설정한다. jest-expo가 제공하는 변환·asset/Expo mock을 재사용하고 기본 설정을 자체 구현하지 않는다. 테스트 중 EXPO_PUBLIC_API_BASE_URL 변경이 Babel 상수 인라이닝에 가려지지 않도록 preset의 test용 caller/preserveEnvVars 동작을 확인한다. 필요하면 이 config 범위에서 test transform caller를 조정한다. 별도 앱 Babel 설정 파일은 추가하지 않는다.
- test-front.cjs의 findTests/resolveTests 계약을 유지한다. 선택 결과만 Jest --runTestsByPath에 전달하고 --runInBand 비감시 실행을 사용한다. status !== 0 또는 signal/spawn 오류를 실패로 반환한다. 원본 TS 컴파일과 임시 출력·삭제 코드를 제거한다. --passWithNoTests를 사용하지 않는다.
- tests/setup.ts는 기본 Expo preset 위에 실제 필요한 native 경계만 mock한다. safe-area는 공식 jest mock을 사용하고 네트워크 응답을 전역 성공값으로 고정하지 않는다. Jest/RNTL cleanup, 타이머·spy·플레이어 구독 정리를 테스트 종료 시 수행한다. global env 값을 바꾸는 개별 테스트는 원래 값 복구를 책임진다. console 오류 일괄 무시 금지.
- tests/support/video.ts의 공개 계약: createMockVideoPlayer(source?: string), mockVideoPlayers 배열, resetMockVideoPlayers(). 생성된 player는 currentTime/duration/playbackRate/status/playing/timeUpdateEventInterval, jest spy play/pause/release, addListener(name, listener) → {remove()}, emit(name, payload), listenerCount(name)을 제공한다. emit은 timeUpdate/statusChange/playingChange/sourceLoad/playbackRateChange에서 해당 필드를 먼저 갱신한 후 구독자에게 전달한다. play/pause는 playingChange를 전달하며 release는 기록·구독 정리를 한다. remove와 release 순서를 기존 추천 테스트가 관찰할 수 있어야 한다.
- expo-video 경계는 공통 player factory를 사용한다. useVideoPlayer는 실제 React useMemo/useEffect 등을 사용해 source 변경/언마운트 시 수명을 관리하고, React 훅 자체를 구현하거나 교체하지 않는다. createVideoPlayer는 source별 player를 만들고 VideoView는 네이티브 View 경계로 렌더링하여 onFirstFrameRender 같은 prop 이벤트를 전달한다. 실제 영상 디코딩 성공을 가장하지 않는다.
- testFrontRunner는 기존 발견/선택/정렬/중복제거/거부 시나리오를 Jest로 이전한다. 하위 프로세스는 media.test.ts와 savedVideos.test.ts만 실행한다. 두 자식 각각의 정상 종료 및 자기 파일만 실행됨을 Jest 출력으로 확인한다. 자기 자신이나 전체 npm test를 자식으로 실행하지 않는다. empty tree·없는 파일·범위 밖 파일·옵션의 실패 계약을 보존한다.
- Jest 호출 결과의 nonzero status·signal/spawn 실패 전파도 실행기 회귀 시나리오에 포함한다. 실제 실패용 제품 테스트를 상시 발견 목록에 추가하지 말고, isolateModules와 child_process 경계 spy로 실행기 반환값을 검증한다. 자식 프로세스를 실행하는 회귀 test에만 60000ms timeout을 지정하고 전역 timeout을 늘리지 않는다.
- media.test.ts는 환경변수 복구와 상대/절대/null URL 계약을 Jest expect로 이전한다. 이후 task들은 이 설정·helper를 읽기만 한다. 지원 API나 설정의 결함은 이 task가 담당한다.

### 수정 허용 파일

- `front/package.json`
- `front/package-lock.json`
- `front/tsconfig.json`
- `front/jest.config.cjs`
- `front/scripts/test-front.cjs`
- `front/tests/setup.ts`
- `front/tests/support/video.ts`
- `front/tests/unit/testFrontRunner.test.ts`
- `front/tests/unit/media.test.ts`

### 의존성과 checks

- depends_on: 없음.
```text
node --check front/jest.config.cjs
node --check front/scripts/test-front.cjs
```

### 반복 작업 위임

불가. 각 실행 경계·생명주기·관찰 결과를 판단해야 하므로 독립적인 반복 치환 작업으로 보지 않는다. 하위 에이전트를 생성하지 않는다. 이 task는 단독 실행한다.

### 주요 로직 코드 또는 변경 예시

실행기의 핵심 호출은 아래와 같다. findTests/resolveTests의 기존 엄격한 파일 선택을 앞단에 유지한다.

```js
function run(testFiles, projectRoot) {
  const result = spawnSync(process.execPath, [
    require.resolve('jest/bin/jest'),
    '--config', join(projectRoot, 'jest.config.cjs'),
    '--runInBand', '--watch=false', '--watchAll=false',
    '--runTestsByPath', ...testFiles,
  ], { cwd: projectRoot, stdio: 'inherit' });
  return result.status ?? 1;
}
```

Jest 설정의 기준값:

```js
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
};
```

영상 helper의 이벤트 전달 핵심은 다음 계약을 따른다. 전체 필드/메서드는 위 구현 계약에 맞춘다.

```ts
const listeners = new Map<string, Set<(payload: any) => void>>();
function addListener(name: string, listener: (payload: any) => void) {
  const current = listeners.get(name) ?? new Set();
  current.add(listener);
  listeners.set(name, current);
  return { remove: () => current.delete(listener) };
}
function deliver(name: string, payload: unknown) {
  for (const listener of [...(listeners.get(name) ?? [])]) listener(payload);
}
```

기준 테스트 예시:

```ts
test('absolute API image URLs remain unchanged', () => {
  expect(resolveApiImageUrl('https://cdn.example.test/poster.jpg'))
    .toBe('https://cdn.example.test/poster.jpg');
});
```

