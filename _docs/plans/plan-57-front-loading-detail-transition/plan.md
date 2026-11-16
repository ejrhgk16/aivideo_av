# 프론트 원형 로딩 통일과 드라마 상세 슬라이드 전환

## 목표
화면의 “불러오는 중” 안내를 원형 로딩으로 바꾸고, 고정 상단과 조작 영역을 유지한 채 아래 데이터 콘텐츠만 대기 상태로 표시한다. 드라마 상세 진입에만 오른쪽 슬라이드 전환을 설정한다.
범위 및 계약/task 구성은 사용자 승인 완료. 이 계획 작성 단계에서는 제품 코드 변경·worker 배정·Git 명령을 실행하지 않는다.

## 범위·비목표·가정
- 대상: 공용 UI, 홈·찾기·보관함·포인트 실제 내역·추천·드라마 상세·본편/프리뷰 진입, 루트의 상세 route 옵션.
- 상단은 각 화면의 기존 구성을 뜻한다. AppTopBar가 없는 화면에 새로 추가하지 않는다. 추천은 기존 피드 전체 영역에 로딩, 기존 하단 탭 구조 유지.
- 조회 방식/API·데이터 모델·전역 상태 소유권·저장/진행률·자막·플레이어 버퍼링·로그인/권한 계약은 변경하지 않는다.
- 빈 데이터/오류 안내는 유지한다. 최저 로딩 표시 시간·새 지연·캐시·스켈레톤은 추가하지 않는다.
- 기존 src/components/ui.tsx 책임 안에서 export를 추가하므로 새 source module·구조 문서 변경은 없다.
- web-prototype/은 읽기·수정·계획·검증에서 제외한다. dev에서 작업하며 branch/worktree를 만들지 않는다.

## 공통 계약
### LOAD-UI
정의: `front/src/components/ui.tsx`의 named export, task-2 소유; task-1·3~10 소비.
```tsx
export function LoadingState({ compact = false }: { compact?: boolean })
```
반환값은 React element. 입력 compact는 optional boolean이며 기본값 false. 콜백·내부 mutable state·네트워크·전역 상태 없음.
기본형: 남은 콘텐츠 높이를 채워 수평/수직 중앙에 large ActivityIndicator 하나. compact=true: footer 흐름 안에서 small ActivityIndicator 하나(상하 padding 16), 목록을 덮지 않음. 색상 colors.accent.
ActivityIndicator에 accessible=true, accessibilityRole="progressbar", accessibilityLabel="로딩 중", accessibilityState={{ busy: true }}. 화면에 로딩 문구·아이콘·버튼은 표시하지 않음. 호출자는 부모 영역 높이를 제공하며 Page의 기존 기본 배치는 변경하지 않음.

### LOAD-CATALOG
정의/소유: `HomeScreen` named export(`front/src/screens/HomeScreen.tsx`) 및 `SearchScreen` named export(`front/src/screens/SearchScreen.tsx`), task-4. API·컴포넌트 입력/export는 기존 그대로. task-3이 검증.
각 화면이 기존 로딩 상태를 계속 소유. 상단바·홈 탭·찾기 제목/검색창/필터는 유지하고, 로딩 문구/섹션별 복수 로딩 대신 결과 콘텐츠 영역에 LOAD-UI 기본형 하나. 세션 복원 중에도 동일.
홈 추천 탭은 featuredStatus/dailyStatus/topThreeStatus 중 loading이 있으면 대기. 실패(error)는 대기 종료이며 다른 필수 응답이 끝나면 기존 섹션별 오류/빈 상태 표시. 선택적 HOME_CAMPAIGN·비선택 탭의 catalog/genres 요청은 추천 로딩을 막지 않음. 최신은 catalogStatus, 랭킹은 topThreeStatus, 장르는 genresStatus만 대기. 장르 tile의 catalog 이미지 보강은 기존 동작대로 비차단.
찾기는 장르 목록→첫 페이지의 기존 순서를 유지하고 genresStatus 또는 status가 loading이면 결과 영역 로딩. 상단 입력을 유지하여 포커스를 잃지 않음. 오류가 난 장르는 기존 오류/재시도 결과를 우선 표시하여 뒤의 pending 목록이 영구 로딩을 만들지 않게 함.
더 보기 중 기존 카드/필터 유지, footer만 LOAD-UI compact형. 성공/빈 목록/실패/재시도·focus·계정 변경·늦은 응답 보호·중복 제거와 API 호출 수/시점은 기존 계약 보존.

### LOAD-HISTORY
정의/소유: `LibraryScreen` named export(`front/src/screens/LibraryScreen.tsx`)와 `PointsScreen` named export(`front/src/screens/PointsScreen.tsx`), task-6. task-5가 검증. 입력/export·API 불변.
보관함의 복원 중 또는 로그인 사용자 목록 idle/loading/소유권 미일치 → 상단바·제목·탭 아래 LOAD-UI 기본형 하나. 로그인 복원 완료 후 비회원이면 기존 로그인 안내; 계정 변경 전 목록은 표시하지 않음.
포인트는 복원/실제 내역 최초 조회 중 → 실제 이용 내역 구역에 LOAD-UI 기본형. 뒤로가기·잔액·탭·체험 행과 historyHeader는 유지. 충전 체험 탭을 실제 내역 응답 때문에 가리지 않음.
양쪽 추가 페이지 → 기존 목록과 체험 행 유지+footer compact형. 빈 결과/오류/재시도/로그인 이동/소유권·세션 차단은 기존대로.

### LOAD-MEDIA
정의/소유: `RecommendationScreen` named export(`front/src/screens/RecommendationScreen.tsx`)는 task-8; `DramaDetailScreen({ id }: { id: string })` named export(`front/src/screens/DramaDetailScreen.tsx`), `PlaybackScreenEpisode` named export(`front/src/screens/playbackScreen_episode.tsx`), `PlaybackScreenPreview({ dramaId, videoId }: { dramaId: string; videoId: string })` named export(`front/src/screens/playbackScreen_preview.tsx`)는 task-10. 기존 나머지 props/exports는 변경하지 않음. 테스트 task-7·9 소비.
추천은 기존 컬렉션 status loading(복원 포함) 동안 기존 flex:1 피드 영역에 LOAD-UI 기본형 하나. 탭 navigator/하단바를 변경하거나 상단바를 추가하지 않음. 컬렉션 완료 후 기존 error/empty/feed 분기. 영상 URL/플레이어 ready/자막을 새로운 전체 로딩 조건에 포함하지 않음.
상세·본편·프리뷰는 기존 최초 loading·복원·소유권 불일치 조건에서 scroll=false Page와 LOAD-UI 기본형. 결과가 오면 기존 콘텐츠/404/오류/로그인/권한/재시도 분기로 전환. 이전 계정·route의 콘텐츠를 로딩 중 노출하지 않음. API·저장·진행률·플레이어 내부 버퍼링·자막 동작 불변.

### DETAIL-NAV
정의/소유: `front/src/app/_layout.tsx`의 기존 AppNavigation 내부 Stack.Screen, task-11. RootLayout default export와 route 호출 소비자는 그대로.
정확한 변경: `<Stack.Screen name="drama/[id]" options={{ animation: 'slide_from_right' }} />`.
기존 router.push로 드라마 상세 진입 시 네이티브 화면이 오른쪽에서 진입; 데이터 준비를 기다려 전환을 지연하지 않음. 복귀는 Stack의 기본 pop 동작. headerShown=false·다른 route·탭 전환/탭바 유지. 웹에 네이티브와 동일한 애니메이션을 보장하는 별도 구현은 추가하지 않음.
근거: SDK 57.0.21 / expo-router 57.0.20, [공식 Stack 문서](https://docs.expo.dev/router/advanced/stack/). 실행 시 설치 타입과 typecheck로 확인. RNTL에서는 실제 네이티브 이동 프레임을 검증하지 않으며 기기 확인 결과/미실행을 별도로 보고.

### LOAD-TEST
runner/라이브러리: package.json 및 package-lock.json 기준 Expo 57.0.21, expo-router 57.0.20, React Native 0.86.3, Jest 29.7.0, jest-expo 57.0.6, RNTL 13.3.3, TypeScript 6.0.3. 실행 시 설치 버전/export와 일치 여부 확인; 임의 업그레이드 없음.
`front/tests/setup.ts`의 cleanup·safe-area·expo-video mock, `front/tests/support/video.ts`의 createMockVideoPlayer/mockVideoPlayers를 재사용. 실제 React/UI/화면을 렌더하며 focus/route는 `expo-router/testing-library`의 renderRouter/testRouter, screen/act/userEvent는 `@testing-library/react-native`에서 import. 작성은 RNTL 스킬 v13·Expo 참조 및 Jest 스킬 준수.
기존 각 테스트 파일의 deferred/render/session/response fixture 재사용. 최초 복원 상태→복원 완료→장르/컬렉션/목록 요청→미완료 progressbar 하나→act 안에서 resolve/reject→해당 콘텐츠/빈 상태/오류를 findBy로 확인. 목록 footer 요청 중에는 현재 카드도 함께 관찰. 모든 pending Promise/타이머/spy/Platform 변경은 기존 정리 규칙을 따름.
mock 경계: 홈/추천은 @/features/home/homeContent의 getHomeCollection; 홈/찾기는 @/features/drama/dramaContent의 getDramaList/getGenres; 상세/프리뷰는 같은 module의 getDramaContent; 보관함은 @/features/playback/savedVideos.getSavedVideos 및 @/features/playback/watchHistory.getWatchHistory; 포인트는 @/features/economy/pointHistory.getPointHistory; 본편/프리뷰는 기존 episodePlayback/previewPlayback 경계; 세션은 @/features/user/UserProvider.useUser. 기존 mock export·API 응답 타입 그대로 사용.
필요 데이터: HomeCollection {code,title,description,dramas}, DramaListPage/SavedVideoPage/WatchHistoryPage/PointHistoryPage의 기존 {items,page,hasNext}, DramaContent·EpisodePlayback·PreviewPlayback, 기존 ApiError fixture. 유효 카드/빈 배열/기존 오류 fixture를 파일 안에서 재사용하며 서버/DB·새 공통 fixture/생성 산출물 불필요.
검증 책임: task-1→2(공통); 3→4(홈/찾기); 5→6(보관함/포인트); 7→8(추천); 9→10(상세/본편/프리뷰 및 savedVideoScreens 통합); 11(RootLayout 소비). 새 공개 export를 import하는 task-1은 타입/동작 검사를 task-2로 유예. 다른 테스트 작성 task는 task-2 뒤 typecheck 가능하므로 즉시 실행하며 변경 동작 검사는 명명된 소스 task로만 유예. 기존 테스트 시나리오와 의미를 보존하고 skip·경고 무시·assertion 약화 금지.
실제 공간 배치/네이티브 슬라이드는 RNTL 범위 밖. 접근성·상태 전환은 자동 검사하고 기기 중앙 정렬·전환은 별도로 보고. 서버 확인은 기존 localhost:8081/3000만 허용하며 서버가 없으면 실환경 검증 실패로 보고하고 자동 실행하지 않음. 안내 명령: `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`.

## Task
| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | loading-state-tests | `front/tests/unit/loadingState.test.tsx` | 미구현 기능 테스트 작성: 계약에 따른 pending/완료 전환 검사 작성 |
| 2 | loading-state-source | `front/src/components/ui.tsx` | 소스 구현: 선행 테스트에 맞춘 구현과 회귀 검사 |
| 3 | home-search-loading-tests | `front/tests/unit/homeScreen.test.tsx`, `front/tests/unit/searchScreen.test.tsx` | 미구현 기능 테스트 작성: 계약에 따른 pending/완료 전환 검사 작성 |
| 4 | home-search-loading-source | `front/src/screens/HomeScreen.tsx`, `front/src/screens/SearchScreen.tsx` | 소스 구현: 선행 테스트에 맞춘 구현과 회귀 검사 |
| 5 | library-points-loading-tests | `front/tests/unit/libraryScreen.test.tsx`, `front/tests/unit/pointsScreen.test.tsx` | 미구현 기능 테스트 작성: 계약에 따른 pending/완료 전환 검사 작성 |
| 6 | library-points-loading-source | `front/src/screens/LibraryScreen.tsx`, `front/src/screens/PointsScreen.tsx` | 소스 구현: 선행 테스트에 맞춘 구현과 회귀 검사 |
| 7 | recommendation-loading-tests | `front/tests/unit/recommendationPreviewBuffer.test.tsx` | 미구현 기능 테스트 작성: 계약에 따른 pending/완료 전환 검사 작성 |
| 8 | recommendation-loading-source | `front/src/screens/RecommendationScreen.tsx` | 소스 구현: 선행 테스트에 맞춘 구현과 회귀 검사 |
| 9 | detail-playback-loading-tests | `front/tests/unit/dramaDetailScreen.test.tsx`, `front/tests/unit/playbackScreenEpisode.test.tsx`, `front/tests/unit/savedVideoScreens.test.tsx` | 미구현 기능 테스트 작성: 계약에 따른 pending/완료 전환 검사 작성 |
| 10 | detail-playback-loading-source | `front/src/screens/DramaDetailScreen.tsx`, `front/src/screens/playbackScreen_episode.tsx`, `front/src/screens/playbackScreen_preview.tsx` | 소스 구현: 선행 테스트에 맞춘 구현과 회귀 검사 |
| 11 | drama-detail-slide-source | `front/src/app/_layout.tsx` | 소스 구현·선언 설정: 상세 route에만 옵션 추가 |

## 실행 순서 및 병렬 작업
- task-1 → task-2: 새 UI export의 테스트 작성 후 구현·검증.
- task-2 이후 task-3/5/7/9는 병렬 가능. 각각 서로 다른 테스트 파일을 소유하며 동일 공용 UI는 읽기만 한다.
- task-4는 task-2/3 후, task-6은 task-2/5 후, task-8은 task-2/7 후 실행. 다른 그룹의 테스트 작성/소스 구현과 파일·fixture·출력이 독립적이면 병렬 가능하다.
- task-10은 task-2/9/4/8 후 실행. savedVideoScreens가 수정된 홈→프리뷰·추천 소비도 검사하므로 task-4/8 결과를 기다린다. task-6과는 독립적이므로 병렬 가능하다.
- task-11은 task-10 후 실행. 상세 로딩을 적용한 뒤 진입 전환만 별도로 설정하고 RootLayout 소비를 검사한다. 독립적인 task-6이 남았다면 병렬 가능하다.
- 모든 수정 파일의 소유 task는 하나다. 테스트/소스 역할을 섞지 않으며 각 worker는 승인 files 안에서 apply_patch만 사용한다.
- 메인을 제외한 worker 총 최대 5, 하위 반복 worker 예약 0. 모든 task의 반복 작업 하위 위임은 불가: 파일마다 다른 비동기 상태·fixture·소비 경계를 판단해야 하며 단순 반복 수정이 아니다. worker는 재위임 없이 직접 수행한다.
- typecheck는 noEmit, 테스트는 프로세스별 mock/deferred를 쓰므로 공유 생성 출력·실제 HTTP/DB fixture·lock 없음. 별도 서버는 시작하지 않는다.

## 검증 계획과 영향 근거
제품 변경은 화면 표현과 route 선언으로 한정된다. 기존 API/세션/플레이어 내부를 바꾸지 않으므로 task별로 담당 화면과 실제 영향을 받는 소비 테스트를 선택한다. 공통 UI가 여러 화면에 쓰이는 영향은 각 화면 검사와 최종 프론트 전체 검사로 확인한다.
테스트 데이터는 LOAD-TEST의 기존 파일 로컬 fixture와 deferred만 사용한다. 생성 파일·새 서버 fixture 없음.

- task-1: 즉시 실행 checks 없음. 새 export 구현이 필요한 타입/동작 검사는 task-2로 유예.
- task-2: `npm --prefix front run typecheck`; `npm --prefix front run test -- tests/unit/loadingState.test.tsx`
- task-3: `npm --prefix front run typecheck`
- task-4: `npm --prefix front run typecheck`; `npm --prefix front run test -- tests/unit/homeScreen.test.tsx tests/unit/searchScreen.test.tsx`
- task-5: `npm --prefix front run typecheck`
- task-6: `npm --prefix front run typecheck`; `npm --prefix front run test -- tests/unit/libraryScreen.test.tsx tests/unit/pointsScreen.test.tsx`
- task-7: `npm --prefix front run typecheck`
- task-8: `npm --prefix front run typecheck`; `npm --prefix front run test -- tests/unit/recommendationPreviewBuffer.test.tsx`
- task-9: `npm --prefix front run typecheck`
- task-10: `npm --prefix front run typecheck`; `npm --prefix front run test -- tests/unit/dramaDetailScreen.test.tsx tests/unit/playbackScreenEpisode.test.tsx tests/unit/savedVideoScreens.test.tsx`
- task-11: `npm --prefix front run typecheck`; `npm --prefix front run test -- tests/unit/sessionExpiredDialog.test.tsx`

실행 중에는 실패한 직접 관련 검사로 수정하고 task의 최종 변경 후 선언 checks를 모두 통과해야 완료한다. 작성 task의 완료는 기능 통과가 아니다. 소스 worker가 범위 밖 테스트 결함을 발견하면 수정/약화하지 말고 메인에 근거를 보고하며 공통 reset 규칙을 따른다.
기기/실서버 확인은 중앙 정렬·상단 유지·상세 슬라이드를 대상으로 결과/미실행을 따로 기록한다. SDK 네이티브 애니메이션을 Jest 통과로 확인했다고 보고하지 않는다.
사용자가 $finish-plan을 명시 호출하면 도구가 변경 파일 기준으로 프론트 전체 typecheck/test/export를 수행한다. 이 계획만으로 commit/push하거나 $harness를 자동 실행하지 않는다.
