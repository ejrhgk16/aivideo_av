# task-5-library-points-loading-tests

## 기본 입력
- 이 task 문서와 index.json의 task-5 항목.
- 컨텍스트로 전달된 루트 AGENTS.md 및 적용 지침 원문, 선행 task 완료 요약.
- 선행 task: task-2.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 task의 변경을 되돌리지 말고 승인된 파일 안에서 수용한다.

## 읽어야 할 파일
- front/tests/unit/libraryScreen.test.tsx: renderLibrary·installRequests·세션/탭/초기/다음 페이지 시나리오
- front/tests/unit/pointsScreen.test.tsx: renderPoints·installRequests·복원/실제내역/체험내역/다음 페이지 시나리오
- front/src/screens/LibraryScreen.tsx: ownsCurrentList·표시 분기
- front/src/screens/PointsScreen.tsx: visibleHistory·historyEmpty·historyHeader·ListFooterComponent
- .agents/skills/react-native-testing/SKILL.md 및 references/api-reference-v13.md·references/expo.md, .agents/skills/javascript-typescript-jest/SKILL.md: 화면 렌더·mock·비동기 검사를 작성/변경할 때 필요한 규약
- front/package.json·front/package-lock.json: 해당 라이브러리 버전 항목만; 실행 환경과 계약 버전 확인.

## 필요 시 참고할 문서
- AGENTS.md: 전달된 원문이 누락되었거나 이후 변경된 경우만.
- _docs/ARCHITECTURE.md의 Frontend 및 Boundaries: 파일 책임/모듈 경계를 바꿔야 한다고 판단한 경우만. 승인 범위와 충돌하면 변경하지 않고 메인에 보고.
- plan.md의 LOAD-UI·LOAD-HISTORY·LOAD-TEST 섹션: 아래 계약의 누락/불일치가 발견된 경우만. 전체 plan 재조회 불필요.
- front/README.md의 검증: 선택 실행 명령/서버 정책이 누락되거나 달라졌을 때만.


## 실패 시 참고할 파일
- 담당 테스트와 그 파일에서 이미 사용하는 helper의 실패한 구간만 확인. 무관한 전체 suite·fixture를 읽지 않는다.

## 작업
복원·초기 조회·보관함 탭 전환에서 헤더·탭 유지와 로딩 하나를 검증한다. 로그인 완료 후 비회원 안내, 빈 결과·오류·재시도, 다음 페이지 중 기존 목록 유지, 계정 변경 후 오래된 목록 숨김을 보존한다. 포인트는 체험 내역과 잔액·충전 탭을 가리지 않고 실제 내역 구역만 로딩하는 것을 확인한다. 기존 로그인 확인/불러오는 중 문구 기대값을 대응하는 progressbar 검증으로 바꾼다.

### 역할과 완료 조건
- 역할: **미구현 기능 테스트 작성**.
- 수정 허용 files:
  - `front/tests/unit/libraryScreen.test.tsx`
  - `front/tests/unit/pointsScreen.test.tsx`
- checks(저장소 루트에서 실행):
  - `npm --prefix front run typecheck`
- 동작 검사 `npm --prefix front run test -- tests/unit/libraryScreen.test.tsx tests/unit/pointsScreen.test.tsx`는 task-6의 제품 구현(해당 화면 로딩 분기와 LOAD-UI 연결)이 필요하므로 그 소스 task로 유예한다. 공용 LoadingState는 선행 task-2에서 존재하므로 typecheck는 즉시 실행한다. 새 독립 helper·runner를 만들지 않는다.
- 범위: 승인 계약의 표시 동작과 해당 소비만. 백엔드·API·전역 상태·영상 내부 동작·다른 route는 변경하지 않는다.
- 수정은 files 안에서 apply_patch만 사용한다. branch/worktree·commit/push·자동 서버 실행을 하지 않는다.
- 작성자는 완료 전 import·실제 export·fixture/mock 전제·이벤트 순서·assertion을 계약 및 도구 API에 대조한다. 기존 시나리오를 skip/약화하거나 경고를 숨기지 않는다.
- 소스 작업자는 관련 실패 검사로 먼저 수정하고 최종 변경 후 선언 checks를 모두 통과시킨다. 테스트 결함이면 범위 밖 수정 없이 메인에 보고한다.
- 완료 요약: 계약 ID별 검증 파일/테스트 이름, 실제 실행 명령과 suite/test/skip 결과, 유예한 검사와 소스 task, 기기/실서버 검증의 결과 또는 미실행을 구분한다. 별도 검토 task는 없다.

### 적용 계약
아래는 plan.md 원본 계약의 해당 task 발췌다. 이름·타입·기본값·동작을 임의로 바꾸지 않는다. 충돌은 메인에 보고하고 관련 작업을 보류한다.

#### LOAD-UI
정의: `front/src/components/ui.tsx`의 named export, task-2 소유; task-1·3~10 소비.
```tsx
export function LoadingState({ compact = false }: { compact?: boolean })
```
반환값은 React element. 입력 compact는 optional boolean이며 기본값 false. 콜백·내부 mutable state·네트워크·전역 상태 없음.
기본형: 남은 콘텐츠 높이를 채워 수평/수직 중앙에 large ActivityIndicator 하나. compact=true: footer 흐름 안에서 small ActivityIndicator 하나(상하 padding 16), 목록을 덮지 않음. 색상 colors.accent.
ActivityIndicator에 accessible=true, accessibilityRole="progressbar", accessibilityLabel="로딩 중", accessibilityState={{ busy: true }}. 화면에 로딩 문구·아이콘·버튼은 표시하지 않음. 호출자는 부모 영역 높이를 제공하며 Page의 기존 기본 배치는 변경하지 않음.

#### LOAD-HISTORY
정의/소유: `LibraryScreen` named export(`front/src/screens/LibraryScreen.tsx`)와 `PointsScreen` named export(`front/src/screens/PointsScreen.tsx`), task-6. task-5가 검증. 입력/export·API 불변.
보관함의 복원 중 또는 로그인 사용자 목록 idle/loading/소유권 미일치 → 상단바·제목·탭 아래 LOAD-UI 기본형 하나. 로그인 복원 완료 후 비회원이면 기존 로그인 안내; 계정 변경 전 목록은 표시하지 않음.
포인트는 복원/실제 내역 최초 조회 중 → 실제 이용 내역 구역에 LOAD-UI 기본형. 뒤로가기·잔액·탭·체험 행과 historyHeader는 유지. 충전 체험 탭을 실제 내역 응답 때문에 가리지 않음.
양쪽 추가 페이지 → 기존 목록과 체험 행 유지+footer compact형. 빈 결과/오류/재시도/로그인 이동/소유권·세션 차단은 기존대로.

#### LOAD-TEST
runner/라이브러리: package.json 및 package-lock.json 기준 Expo 57.0.21, expo-router 57.0.20, React Native 0.86.3, Jest 29.7.0, jest-expo 57.0.6, RNTL 13.3.3, TypeScript 6.0.3. 실행 시 설치 버전/export와 일치 여부 확인; 임의 업그레이드 없음.
`front/tests/setup.ts`의 cleanup·safe-area·expo-video mock, `front/tests/support/video.ts`의 createMockVideoPlayer/mockVideoPlayers를 재사용. 실제 React/UI/화면을 렌더하며 focus/route는 `expo-router/testing-library`의 renderRouter/testRouter, screen/act/userEvent는 `@testing-library/react-native`에서 import. 작성은 RNTL 스킬 v13·Expo 참조 및 Jest 스킬 준수.
기존 각 테스트 파일의 deferred/render/session/response fixture 재사용. 최초 복원 상태→복원 완료→장르/컬렉션/목록 요청→미완료 progressbar 하나→act 안에서 resolve/reject→해당 콘텐츠/빈 상태/오류를 findBy로 확인. 목록 footer 요청 중에는 현재 카드도 함께 관찰. 모든 pending Promise/타이머/spy/Platform 변경은 기존 정리 규칙을 따름.
mock 경계: 홈/추천은 @/features/home/homeContent의 getHomeCollection; 홈/찾기는 @/features/drama/dramaContent의 getDramaList/getGenres; 상세/프리뷰는 같은 module의 getDramaContent; 보관함은 @/features/playback/savedVideos.getSavedVideos 및 @/features/playback/watchHistory.getWatchHistory; 포인트는 @/features/economy/pointHistory.getPointHistory; 본편/프리뷰는 기존 episodePlayback/previewPlayback 경계; 세션은 @/features/user/UserProvider.useUser. 기존 mock export·API 응답 타입 그대로 사용.
필요 데이터: HomeCollection {code,title,description,dramas}, DramaListPage/SavedVideoPage/WatchHistoryPage/PointHistoryPage의 기존 {items,page,hasNext}, DramaContent·EpisodePlayback·PreviewPlayback, 기존 ApiError fixture. 유효 카드/빈 배열/기존 오류 fixture를 파일 안에서 재사용하며 서버/DB·새 공통 fixture/생성 산출물 불필요.

### 반복 작업 위임
불가. 이 task는 각 화면의 비동기 상태·fixture 또는 공용 UI 계약을 직접 판단하는 작업이므로 하위 worker를 만들지 않는다. 하위 슬롯 배정 0. 부모가 직접 통합·검증하고 파일 밖 변경은 하지 않는다.

### 주요 로직 코드 또는 변경 예시
아래는 핵심 흐름 예시다. 기존 코드에 연결할 때 계약과 기존 스타일을 유지하고, 테스트용 제품 props 또는 승인되지 않은 새 공개 export를 추가하지 않는다.

```tsx
// libraryScreen.test.tsx의 기존 복원 시나리오
const requests = installRequests();
const view = renderLibrary();
expect(screen.getByRole('tab', { name: '저장한 작품' })).toBeOnTheScreen();
expect(screen.getByRole('progressbar', { name: '로딩 중' })).toBeBusy();
view.setSession(makeSession(makeUser('user-a'), 1, false));
await act(async () => {
  requests.saved[0].resolve(savedPage([preview]));
  await requests.saved[0].promise;
});
expect(await screen.findByRole('button', { name: '작품 하나 미리보기' })).toBeOnTheScreen();
```
