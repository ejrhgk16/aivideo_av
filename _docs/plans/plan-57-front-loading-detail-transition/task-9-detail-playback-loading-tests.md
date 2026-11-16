# task-9-detail-playback-loading-tests

## 기본 입력
- 이 task 문서와 index.json의 task-9 항목.
- 컨텍스트로 전달된 루트 AGENTS.md 및 적용 지침 원문, 선행 task 완료 요약.
- 선행 task: task-2.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 task의 변경을 되돌리지 말고 승인된 파일 안에서 수용한다.

## 읽어야 할 파일
- front/tests/unit/dramaDetailScreen.test.tsx: renderDetail·resolveDrama·복원/실패/늦은 응답 시나리오
- front/tests/unit/playbackScreenEpisode.test.tsx: 렌더 helper·초기 로딩/복원/계정 변경 시나리오
- front/tests/unit/savedVideoScreens.test.tsx: renderPreview·deferred·preview 복원/진입 시나리오; 홈·추천 시나리오는 기존 기대값 보존
- front/src/screens/DramaDetailScreen.tsx: 최초 로딩/404/error 분기
- front/src/screens/playbackScreen_episode.tsx: 최초 로딩·playbackOwner gate
- front/src/screens/playbackScreen_preview.tsx: 최초 로딩·stateSessionVersion/stateOwnerUuid gate
- .agents/skills/react-native-testing/SKILL.md 및 references/api-reference-v13.md·references/expo.md, .agents/skills/javascript-typescript-jest/SKILL.md: 화면 렌더·mock·비동기 검사를 작성/변경할 때 필요한 규약
- front/package.json·front/package-lock.json: 해당 라이브러리 버전 항목만; 실행 환경과 계약 버전 확인.

## 필요 시 참고할 문서
- AGENTS.md: 전달된 원문이 누락되었거나 이후 변경된 경우만.
- _docs/ARCHITECTURE.md의 Frontend 및 Boundaries: 파일 책임/모듈 경계를 바꿔야 한다고 판단한 경우만. 승인 범위와 충돌하면 변경하지 않고 메인에 보고.
- plan.md의 LOAD-UI·LOAD-MEDIA·LOAD-TEST 섹션: 아래 계약의 누락/불일치가 발견된 경우만. 전체 plan 재조회 불필요.
- front/README.md의 검증: 선택 실행 명령/서버 정책이 누락되거나 달라졌을 때만.


## 실패 시 참고할 파일
- 담당 테스트와 그 파일에서 이미 사용하는 helper의 실패한 구간만 확인. 무관한 전체 suite·fixture를 읽지 않는다.

## 작업
세 화면의 문구 기반 로딩 검사를 progressbar 기반으로 바꾸고 pending→성공·오류·없는 작품/영상 전환을 검증한다. 상세는 renderDetail·deferred, 본편은 기존 API deferred, 프리뷰는 savedVideoScreens의 getDramaContent/getPreviewPlayback mock과 정확한 route video를 사용한다. 세션 복원·계정/route 변경 시 이전 콘텐츠를 보이지 않게 하는 기존 시나리오를 유지한다. 슬라이드 옵션 자체를 복제하는 테스트나 실제 디코딩 검사는 추가하지 않는다.

### 역할과 완료 조건
- 역할: **미구현 기능 테스트 작성**.
- 수정 허용 files:
  - `front/tests/unit/dramaDetailScreen.test.tsx`
  - `front/tests/unit/playbackScreenEpisode.test.tsx`
  - `front/tests/unit/savedVideoScreens.test.tsx`
- checks(저장소 루트에서 실행):
  - `npm --prefix front run typecheck`
- 동작 검사 `npm --prefix front run test -- tests/unit/dramaDetailScreen.test.tsx tests/unit/playbackScreenEpisode.test.tsx tests/unit/savedVideoScreens.test.tsx`는 task-10의 제품 구현(해당 화면 로딩 분기와 LOAD-UI 연결)이 필요하므로 그 소스 task로 유예한다. 공용 LoadingState는 선행 task-2에서 존재하므로 typecheck는 즉시 실행한다. 새 독립 helper·runner를 만들지 않는다.
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

#### LOAD-MEDIA
정의/소유: `RecommendationScreen` named export(`front/src/screens/RecommendationScreen.tsx`)는 task-8; `DramaDetailScreen({ id }: { id: string })` named export(`front/src/screens/DramaDetailScreen.tsx`), `PlaybackScreenEpisode` named export(`front/src/screens/playbackScreen_episode.tsx`), `PlaybackScreenPreview({ dramaId, videoId }: { dramaId: string; videoId: string })` named export(`front/src/screens/playbackScreen_preview.tsx`)는 task-10. 기존 나머지 props/exports는 변경하지 않음. 테스트 task-7·9 소비.
추천은 기존 컬렉션 status loading(복원 포함) 동안 기존 flex:1 피드 영역에 LOAD-UI 기본형 하나. 탭 navigator/하단바를 변경하거나 상단바를 추가하지 않음. 컬렉션 완료 후 기존 error/empty/feed 분기. 영상 URL/플레이어 ready/자막을 새로운 전체 로딩 조건에 포함하지 않음.
상세·본편·프리뷰는 기존 최초 loading·복원·소유권 불일치 조건에서 scroll=false Page와 LOAD-UI 기본형. 결과가 오면 기존 콘텐츠/404/오류/로그인/권한/재시도 분기로 전환. 이전 계정·route의 콘텐츠를 로딩 중 노출하지 않음. API·저장·진행률·플레이어 내부 버퍼링·자막 동작 불변.

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
// dramaDetailScreen.test.tsx의 기존 helper 사용
const view = renderDetail();
expect(screen.getByRole('progressbar', { name: '로딩 중' })).toBeBusy();
expect(screen.queryByText('작품 정보를 불러오는 중이에요')).not.toBeOnTheScreen();
await resolveDrama(view.request);
expect(await screen.findByRole('tab', { name: /전체 회차/ })).toBeOnTheScreen();
expect(screen.queryByRole('progressbar', { name: '로딩 중' })).not.toBeOnTheScreen();
```
