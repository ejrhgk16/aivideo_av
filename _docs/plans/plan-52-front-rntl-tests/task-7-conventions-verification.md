# task-7-conventions-verification

## 기본 입력

- 이 task 문서와 index.json의 task-7 항목.
- 컨텍스트로 전달된 루트·front 적용 지침 및 선행 task 완료 요약. 다른 작업자가 함께 작업하므로 다른 task의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- front/AGENTS.md의 현재 Tests 절과 _docs/ARCHITECTURE.md의 Frontend/Boundaries 책임 표.
- 신규 front/tests/README.md는 아래 정확한 규약을 기준으로 작성한다.
- task-1~6 완료 요약의 시나리오 대응·mock API·환경/정리·정적 검사 결과.
- front/package.json과 scripts/test-front.cjs의 실행 명령 계약, jest.config.cjs의 발견/선택 설정. 설정 파일은 읽기 전용이다.

## 필요 시 참고할 문서

- 전달된 적용 지침이 누락되었거나 변경되었을 때만 AGENTS.md와 front/AGENTS.md의 테스트·셸 규칙을 확인한다.
- 테스트/제품 책임 경계 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend와 Boundaries를 확인한다.
- 이 문서의 승인 계약이 누락되거나 충돌할 때만 plan.md의 승인된 계약 및 기능별 검증 대응을 확인한다. 전체 plan 재독은 필요하지 않다.

## 실패 시 참고할 파일

- 특정 Jest 실패 때만 해당 front/tests/unit 테스트 파일과 fixture/support/video.ts를 읽는다. 테스트 실행 자체를 위해 모든 테스트 구현을 미리 읽지 않는다.
- 실행기 실패 때만 scripts/test-front.cjs 및 testFrontRunner.test.ts, Jest 설정과 setup을 확인한다.
- typecheck/export 실패 때만 에러 경로의 직접 의존 타입/설정을 확인한다. 승인 범위 밖 제품 코드 수정으로 우회하지 않는다.

## 작업

프론트 테스트 규약과 파일 책임을 문서에 선언하고, task-1~6의 이전 결과에 대해 선택 실행과 전체 검증을 책임진다.

### 역할과 완료 조건

소스/문서 적용 및 테스트 실행 역할이다. 이번 작업은 제품 동작을 바꾸지 않는 테스트 기반 이전이므로 인위적인 제품 src 수정은 하지 않는다. task-1~6을 depends_on으로 받고 아래 선언된 모든 checks를 직접 실행·통과한 후에만 완료한다. 작성 완료 요약을 기능 통과로 간주하지 않는다.

테스트·fixture·실행기·패키지를 이 task에서 수정하지 않는다. 실패 시 실제 증거(명령, 실패 assertion/타입 오류, 대상 파일, 원인)를 소유 작성 task에 전달하고 해당 범위의 수정 후 관련 선택 검증과 필요한 전체 검증을 다시 실행한다. 기대값 약화·테스트 skip·선택 경로 누락·console 숨김으로 통과시키지 않는다. 승인 범위를 벗어나는 제품 버그는 별도 보고하며 임의로 제품 코드를 변경하지 않는다.

### 문서에 선언할 정확한 규약

- front/AGENTS.md Tests 절: Jest + jest-expo가 공통 실행 기반이고 화면/컴포넌트/훅은 @testing-library/react-native를 사용한다고 명시한다. API/순수 함수는 Jest 단위 테스트다. 제품 테스트 위치는 front/tests/**/*.test.ts(x)를 유지한다.
- 같은 절: React 훅·JSX runtime 전체 mock, 자체 훅/렌더러/트리 실행, 제품 소스 readFile+transpile+vm 실행을 금지한다. 설치된 Expo/RNTL 버전의 공식 API를 사용하며 SDK 57의 RNTL 13 호환 조합을 명시한다.
- 같은 절: 접근성 role/name·label·사용자 입력·보이는 결과 우선, native/API 경계의 최소 mock, 실제 Router 포커스/cleanup, 환경·타이머·mock·구독 복구, 기존 시나리오 보존/실패 숨김 금지 규칙을 추가한다. 예외적인 Modal/Slider/스크롤/player 이벤트 접근에는 이유를 기록한다.
- 같은 절: 기존 npm run test 전체/정확한 파일 선택 실행과 task 선택 checks·최종 finish 검증 규칙을 유지하고 새 .tsx 예시를 맞춘다. 상세 계약은 tests/README.md로 연결한다.
- front/tests/README.md: 테스트 목적/한계, 실행 전제·버전 조합, 파일 역할(unit/setup/support), 전체·단일·다중 파일 명령, 화면 RNTL 예시와 함수 Jest 예시, Router/API/세션/native player 경계, act/findBy/waitFor/userEvent와 타이머/cleanup 사용, forbidden patterns, 시나리오 이전/검증 결과 보고 방법을 선언한다. 실행기 옵션은 임의 추가하지 않는다.
- 같은 문서: 컴포넌트 테스트는 서버/DB/네트워크를 쓰지 않으며 실제 영상 디코딩·브라우저 레이아웃·기기 터치를 보장하지 않음을 명시한다. jsdom native listener/scroll boundary 테스트와 실제 E2E를 구분한다.
- _docs/ARCHITECTURE.md: Frontend 책임 표에 tests의 Jest/RNTL 테스트 책임과 scripts/test-front.cjs의 정확한 파일 선택→Jest 실행 책임, jest.config.cjs 및 tests/setup.ts/support의 설정/외부 native 경계 책임을 반영한다. 범위 밖 backend나 구조는 수정하지 않는다.

### 검증과 보고

- 24개 원본 파일의 시나리오 대응을 task 요약과 비교한다. 최종 24개 테스트 파일은 .ts 15개와 .tsx 9개이며 이전된 9개 .ts는 남지 않아야 한다. helper/setup/문서는 발견 대상이 아니다. 파일 수만으로 성공을 주장하지 않는다.
- node:test/node:assert·vm·transpileModule·커스텀 React/JSX mock 및 수동 hook/트리 실행이 front/tests에 남지 않는지 내용 검토한다. runner 테스트의 fs/자식 프로세스 사용은 실행기 계약 검증 예외다. 테스트 구현이 코드 문자열을 로드하는 방식으로 회귀하지 않았는지 본다.
- 아래 6개 그룹 선택 실행은 각각 task-1~6의 정확한 대상이다. 순서대로 실행하여 실패 소유권을 분명히 하고, 이어 typecheck·무인자 전체 test·export를 실행한다. 공통 실행기/전 테스트 이전이므로 전체 검증이 필요하다.
- 최종 전체 test에서는 Jest summary의 suite 수·성공·실패·skip와 실제 발견 목록을 대조한다. 선택 실행과 전체 실행의 발견/타입/모듈 격리 차이를 확인한다.
- 규약 문서 예시의 경로·패키지·명령이 실제 파일/스크립트와 맞고, 금지된 방식이 예시에 다시 들어가지 않았는지 확인한다. 읽기 전용 파일은 files에 추가하지 않는다.
- 검증 결과에 명령별 exit와 suite/test 결과, native/browser 한계, 시나리오 대응/문서 검토 결과를 보고한다. 테스트 미실행/실패를 통과로 처리하지 않는다. 최종 $finish-plan의 전체 검증·commit/push 동작은 그대로 둔다.


### 수정 허용 파일

- `front/AGENTS.md`
- `front/tests/README.md`
- `_docs/ARCHITECTURE.md`

### 의존성과 checks

- depends_on: task-1, task-2, task-3, task-4, task-5, task-6.

```text
npm --prefix front run test -- tests/unit/testFrontRunner.test.ts tests/unit/media.test.ts
npm --prefix front run test -- tests/unit/api.test.ts tests/unit/dramaContent.test.ts tests/unit/episodePlayback.test.ts tests/unit/episodePurchase.test.ts tests/unit/errorMessages.test.ts tests/unit/homeContent.test.ts tests/unit/login.test.ts tests/unit/pointHistory.test.ts tests/unit/previewPlayback.test.ts tests/unit/savedVideos.test.ts tests/unit/session.test.ts tests/unit/watchHistory.test.ts tests/unit/watchProgress.test.ts
npm --prefix front run test -- tests/unit/dramaDetailScreen.test.tsx tests/unit/searchScreen.test.tsx tests/unit/libraryScreen.test.tsx tests/unit/pointsScreen.test.tsx
npm --prefix front run test -- tests/unit/episodeUnlockDialog.test.tsx tests/unit/sessionExpiredDialog.test.tsx
npm --prefix front run test -- tests/unit/playbackScreenEpisode.test.tsx tests/unit/savedVideoScreens.test.tsx
npm --prefix front run test -- tests/unit/recommendationPreviewBuffer.test.tsx
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

### 반복 작업 위임

불가. 통합 실패와 문서 규약의 일치 여부를 한 worker가 책임진다. task-1~6 완료 후 단독 실행한다. 하위 에이전트를 생성하지 않는다.

### 주요 로직 코드 또는 변경 예시

새 제품 로직은 없다. 이 task는 위 문구·문서 책임을 적용하고 선언된 checks를 실행한다. 테스트를 구현하거나 수정하지 않으므로 인위적인 소스 코드 예시는 필요하지 않다.

규약에 넣을 실행 예시는 실제 이전 후 경로를 사용한다.

```powershell
npm --prefix front run test
npm --prefix front run test -- tests/unit/searchScreen.test.tsx
npm --prefix front run test -- tests/unit/api.test.ts tests/unit/session.test.ts
npm --prefix front run typecheck
npm --prefix front run export
```

front/AGENTS.md에는 적어도 다음 문장을 포함한다.

> 프론트 테스트는 Jest와 jest-expo로 실행한다. 화면·컴포넌트·훅 테스트는 React Native Testing Library를 사용하며, React 훅·JSX runtime·렌더러를 직접 구현하거나 제품 소스를 읽어 VM에서 실행하지 않는다. API·순수 함수 테스트는 Jest로 작성한다. 사용자 입력과 접근 가능한 화면 결과를 우선 검증하고 API·네이티브 등 외부 경계만 필요한 만큼 모킹한다.

상세 버전·정리·실행 규칙은 위 계약을 같은 Tests 절 및 tests/README.md에 이어 선언한다.

