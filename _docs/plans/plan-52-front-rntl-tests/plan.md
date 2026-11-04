# plan-52-front-rntl-tests

## 목표

현재 프론트 제품 테스트 24개 파일을 Jest 실행 기반으로 통일한다. 화면·컴포넌트는 React Native Testing Library(RNTL)와 실제 React로 렌더링하고, API·순수 함수는 Jest 단위 테스트로 유지한다. React 훅·JSX 객체 트리·VM 실행을 자체 구현하는 방식을 제거하고 앞으로 적용할 작성·실행 규약을 선언한다.

## 승인과 범위

- 사용자가 범위와 7개 task 구성을 각각 승인한 후 생성한 계획이다.
- 변경 대상은 front 테스트·실행 설정·관련 규약/구조 문서다. 제품 src, 백엔드, DB, REST 계약, Expo/React Native/React 버전, Harness 도구·스킬은 변경하지 않는다.
- Playwright·기기 E2E, 시각 회귀, 새로운 기능·테스트 시나리오 확대는 범위가 아니다. 라이브러리 이전과 실행 계약 회귀 확인에 필요한 테스트만 변경한다.
- dev에서 진행하며 branch/worktree 생성과 직접 Git 조작을 하지 않는다. 이번 계획 생성은 실행·설치·제품 테스트를 수행한 것이 아니다.

## 승인된 계약

1. Expo 57 / React Native 0.86.3 / React 19.2.3을 유지한다. 기준 조합은 jest 29.7.0, @types/jest 29.5.14, jest-expo ~57.0.5, @react-native/jest-preset 0.86.3, @testing-library/react-native 13.3.3, react-test-renderer 19.2.3, jest-environment-jsdom 29.7.0이다. package-lock으로 실제 버전을 고정한다. React와 react-test-renderer 버전은 정확히 맞춘다. SDK 57의 expo-router/testing-library는 RNTL 13을 사용한다. 최신 SDK 58/RNTL 14 예시를 혼용하지 않는다.
2. 모든 제품 테스트의 실행·assertion은 Jest로 통일한다. 화면은 RNTL render·screen·userEvent·fireEvent·findBy/waitFor, 실제 hook을 검사할 경우 renderHook을 사용한다. 순수 함수에 불필요한 렌더링을 도입하지 않는다.
3. React / react/jsx-runtime 전체 mock, useState/useEffect/useRef/useMemo/useCallback의 자체 구현, 컴포넌트 함수 직접 호출, 자체 트리 순회, 제품 소스 readFile+transpile+vm 실행을 금지한다. Node 파일 API는 실행기 경로 선택·발견 테스트에만 필요한 범위로 사용할 수 있다.
4. 화면의 AppText/Button/Page/EmptyState와 검증 대상 컴포넌트는 실제 구현을 렌더링한다. API, 세션 입력, 폰트/이미지/네이티브 영상·Slider, 시간·레이아웃/스크롤 이벤트 등 외부 경계만 필요한 만큼 mock한다. 실제 useFocusEffect와 cleanup은 expo-router/testing-library의 메모리 라우터에서 실행한다. 라우터 훅 자체를 가짜 effect로 다시 만들지 않는다.
5. 테스트는 접근성 role/name, label, 표시 텍스트, 사용자 입력과 공개 결과를 우선 관찰한다. 직접 네이티브 이벤트가 필요한 Modal.onDismiss/FlatList/Slider/VideoView 등에는 이유를 적고 RNTL fireEvent, createNodeMock 또는 제한된 spy를 사용한다. 그것을 실제 기기·브라우저 렌더링 검증이라고 보고하지 않는다. 스냅샷만으로 기존 동작 assertion을 대체하지 않는다.
6. 기존 시나리오 전체를 보존한다. 각 작성 task는 원본 최상위·하위 테스트와 이전된 테스트의 이름·동작 대응을 완료 요약에 적는다. 숨겨진 Modal의 자체 객체 구조와 같이 기존 가짜 렌더러에 종속된 관찰은 숨김/콜백이라는 실제 계약으로 바꾸되 사유를 적는다. 오류를 무시하거나 expect를 지워 통과시키지 않는다.
7. npm --prefix front run test는 tests 아래 모든 .test.ts/.test.tsx를 발견·정렬해 한 번 실행하고, 인자가 있으면 정확한 파일만 중복 제거해 실행한다. 범위 밖 경로·없는 파일·옵션은 실패한다. 빈 목록이나 Jest 실패를 성공으로 처리하지 않는다. 실행기는 경로 선택과 Jest 호출만 맡고 직접 TS 컴파일·Node --test·임시 빌드 트리를 만들지 않는다. 실행은 비감시 모드이며 개별 호출은 runInBand로 자원 사용을 제한한다.
8. 각 Jest 호출/테스트는 mock·타이머·process.env·세션 singleton·DOM listener·플레이어 구독을 격리/복구한다. 공통 동작은 tests/setup.ts와 tests/support/video.ts에만 둔다. 글로벌 console 경고·에러를 일괄 숨기지 않는다. fixture/지원 파일은 테스트 발견 대상이 아니다. tests/unit/testFrontRunner는 다른 두 파일을 선택한 자식 실행만 하여 자기 재귀 실행을 피한다.
9. 모든 검증은 API·영상·S3를 실제 호출하지 않는 단위/컴포넌트 테스트다. 개발 서버가 필요하지 않으며 자동 서버 실행·포트 우회·DB 변경은 없다. 추천 웹 이벤트는 jsdom과 createNodeMock 경계에서 검증하며 실제 브라우저 동작까지 보장하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | Jest·RNTL 실행 기반과 기준 테스트 작성 | `front/package.json`, `front/package-lock.json`, `front/tsconfig.json`, `front/jest.config.cjs`, `front/scripts/test-front.cjs`, `front/tests/setup.ts`, `front/tests/support/video.ts`, `front/tests/unit/testFrontRunner.test.ts`, `front/tests/unit/media.test.ts` | 설정·경로 선택 실행기·기준 테스트와 공유 영상 mock 작성 |
| 2 | API·세션·순수 로직 테스트 이전 작성 | `front/tests/unit/api.test.ts`, `front/tests/unit/dramaContent.test.ts`, `front/tests/unit/episodePlayback.test.ts`, `front/tests/unit/episodePurchase.test.ts`, `front/tests/unit/errorMessages.test.ts`, `front/tests/unit/homeContent.test.ts`, `front/tests/unit/login.test.ts`, `front/tests/unit/pointHistory.test.ts`, `front/tests/unit/previewPlayback.test.ts`, `front/tests/unit/savedVideos.test.ts`, `front/tests/unit/session.test.ts`, `front/tests/unit/watchHistory.test.ts`, `front/tests/unit/watchProgress.test.ts` | API·인증·세션·요청·순수 규칙을 Jest로 이전 |
| 3 | 목록·상세 화면 RNTL 테스트 작성 | `front/tests/unit/dramaDetailScreen.test.ts`, `front/tests/unit/dramaDetailScreen.test.tsx`, `front/tests/unit/searchScreen.test.ts`, `front/tests/unit/searchScreen.test.tsx`, `front/tests/unit/libraryScreen.test.ts`, `front/tests/unit/libraryScreen.test.tsx`, `front/tests/unit/pointsScreen.test.ts`, `front/tests/unit/pointsScreen.test.tsx` | 목록·상세·검색·포인트의 실제 React 렌더링 |
| 4 | 구매·세션 만료 팝업 RNTL 테스트 작성 | `front/tests/unit/episodeUnlockDialog.test.ts`, `front/tests/unit/episodeUnlockDialog.test.tsx`, `front/tests/unit/sessionExpiredDialog.test.ts`, `front/tests/unit/sessionExpiredDialog.test.tsx` | 구매·만료 팝업의 닫힘/세션/이동 계약 유지 |
| 5 | 본편·미리보기·홈 RNTL 테스트 작성 | `front/tests/unit/playbackScreenEpisode.test.ts`, `front/tests/unit/playbackScreenEpisode.test.tsx`, `front/tests/unit/savedVideoScreens.test.ts`, `front/tests/unit/savedVideoScreens.test.tsx` | 본편·미리보기·홈의 저장·재생 이벤트 계약 유지 |
| 6 | 추천 피드·버퍼 RNTL 테스트 작성 | `front/tests/unit/recommendationPreviewBuffer.test.ts`, `front/tests/unit/recommendationPreviewBuffer.test.tsx` | 버퍼·추천 피드·제스처·웹 이벤트 경계 이전 |
| 7 | 프론트 테스트 규약 적용 및 통합 검증 | `front/AGENTS.md`, `front/tests/README.md`, `_docs/ARCHITECTURE.md` | 문서에 규약 선언 후 선택·전체·타입·export 검증 |

## 기능별 검증 대응

| 작성 task | 검증 대상과 영향 근거 | 실행 담당 |
| --- | --- | --- |
| task-1 | 모든 테스트가 사용하는 발견/선택/Jest 진입점, media 기준 테스트, 두 자식 선택 실행의 격리 | task-7 |
| task-2 | API auth/오류/refresh, 목록/상세/재생/구매 요청, 세션 경쟁·저장소, saved/history/point history 계약, 진행률 큐·재시도 | task-7 |
| task-3 | 상세 권한, 검색 복원·필터, 보관함 저장/기록 페이징, 포인트 내역 및 계정/포커스별 늦은 응답 무시 | task-7 |
| task-4 | 구매 중복/닫힘/플랫폼 완료, 세션 변경 취소, 루트 만료 팝업과 로그인 이동 | task-7 |
| task-5 | 본편/미리보기 UUID별 저장, 일시정지 유지, 유효 진행에만 시청기록, 홈 현재 hero 미리보기 이동 | task-7 |
| task-6 | 이전·현재·다음 버퍼, 해제/구독 순서, 갱신·정렬·스와이프·휠·resize·저장 경쟁·현재 영상 진행만 기록 | task-7 |

각 그룹의 정확한 선택 실행 명령은 task-7의 checks에 선언했다. 공통 실행기와 전체 테스트 형식을 바꾸므로 영향 범위를 일부 화면으로 한정할 수 없다. 선택 실행에 이어 무인자 전체 실행·typecheck·export를 수행한다. 전체 실행은 발견 누락과 suite 간 오염을 확인하므로 선택 검증을 대체하지 않는다.

## 실행 순서 및 병렬 작업

- task-1은 의존성이 없고 단독 실행한다. 공유 package/lockfile/config/setup/video helper와 기준 테스트를 확정한다. 기능 테스트 실행 없이 정적 검사와 계약 검토를 마친다.
- task-2, task-3, task-4, task-5, task-6은 task-1 완료 후 병렬 실행할 수 있다. 수정 파일이 서로 겹치지 않고, 공유 지원 파일은 읽기 전용이며 테스트 데이터는 각 파일의 메모리에서만 만든다. 작성 단계에는 동작 테스트를 실행하지 않으므로 Jest 출력/캐시/fixture 충돌도 없다.
- 메인 외 동시 부모 worker는 최대 5개다. task-2~6에 각 1개를 배정하며 하위 에이전트 슬롯은 예약하지 않는다. 모든 task는 2뎁스 반복 위임 불가다. 파일별 수명주기·mock·시나리오 판단이 필요하다.
- task-7은 task-1~6 모두 완료 후 단독 실행한다. 규약·구조 문서를 갱신하고 모든 동작 checks를 순서대로 수행한다. 소스/문서 구현 및 실행 역할이며, 제품 동작 변경이 없는 이전 작업이므로 인위적인 src 변경을 배정하지 않는다.
- task-7에서 결함이 발견되면 증거를 작성 task 소유자에게 돌려보내 해당 task의 파일 범위 안에서 수정한다. 통합 worker는 테스트를 직접 고치거나 assertion을 약화하지 않는다. task-7은 필요한 재검증이 끝나기 전 완료할 수 없다. 상태 재시도는 기존 Harness 규칙으로 조정하며 별도 JSON 필드·역할을 추가하지 않는다.
- task-7 내부 실행기 회귀 테스트가 만드는 두 자식 Jest 프로세스는 각각 media 또는 savedVideos만 선택한다. 영속 report/coverage 출력과 수동 공유 fixture를 만들지 않는다. Jest가 관리하는 캐시를 직접 편집/삭제하지 않는다.
- 최종 $finish-plan은 기존 방식대로 task checks와 front 전체 검증을 수행한다. 이 계획에서 commit/push를 실행하지 않는다.

## 검증 명령

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

## 참고 근거

- 설치된 front/node_modules/expo/bundledNativeModules.json의 jest-expo ~57.0.5 및 실제 Expo/React 버전.
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Expo Router testing의 SDK 57/RNTL 13 호환 안내](https://docs.expo.dev/router/reference/testing/).
- [SDK 57 jest-expo package](https://github.com/expo/expo/blob/sdk-57/packages/jest-expo/package.json), [RN 0.86.3 preset](https://github.com/facebook/react-native/blob/v0.86.3/packages/jest-preset/package.json).
- [RNTL 13.3.3 package](https://github.com/callstack/react-native-testing-library/blob/v13.3.3/package.json), [render와 createNodeMock](https://github.com/callstack/react-native-testing-library/blob/v13.3.3/src/render.tsx). 해당 설치 버전의 API를 사용한다.

## 검증 결과

- 계획 생성 시: 범위·task 구성 승인 완료. 제품 테스트·의존성 설치 미실행.
- task 문서 7개를 다시 열어 핵심 로직/테스트 예시, 정확한 수정 파일, 역할별 읽기 범위, 테스트 작성→문서 적용/실행 의존성, 완료 조건과 위임 불가·동시 예산을 재검토했다.
- 읽기 전용 구조 검사 통과: 원본 테스트 24개 모두 작성 task에 배정, 선택 실행 대상 24개 일치, 화면 9개만 .tsx 이전, task-7이 모든 작성 task에 의존하며 동작 검증을 담당한다.
- node tools/harness/cli.mjs validate --plan plan-52-front-rntl-tests: exit 0, valid:true. 계획 상태 draft, task 7개 모두 pending.

