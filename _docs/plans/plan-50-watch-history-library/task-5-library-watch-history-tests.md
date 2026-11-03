# task-5-library-watch-history-tests

## 읽어야 할 파일

- AGENTS.md, front/AGENTS.md, _docs/ARCHITECTURE.md의 프론트·Harness 규칙
- 이 폴더의 plan.md의 조회·카드·상태 계약과 index.json의 task-5 항목
- front/tests/unit/libraryScreen.test.ts의 화면·탭·요청/세션 harness
- front/tests/unit/savedVideos.test.ts의 필수 인증·라우팅 검사
- front/src/features/user/sessionClient.ts의 configureSessionClient와 필수 인증 공개 인터페이스
- front/src/features/playback/playbackResponses.ts의 현재 저장 목록 응답 타입
- _docs/api/04-playback/saved-videos.md, _docs/api/00-overview/error-code.md
- 코드 작성 전 공식 문서: https://docs.expo.dev/versions/v57.0.0/ 와 https://docs.expo.dev/versions/v57.0.0/sdk/router/

## 필요 시 참고할 파일

- front/src/screens/LibraryScreen.tsx의 탭 이름·기존 카드 props·이동 진입점
- front/src/screens/AccountScreen.tsx의 history 직접 진입 인자
- front/src/features/playback/savedVideos.ts의 savedVideoRoute/getSavedVideos 인터페이스
- task-2가 생성할 API 문서나 task-6의 새 소스는 작성 전 존재를 요구하지 않는다. 승인된 plan.md 계약을 기준으로 작성한다.

## 작업

depends_on은 없다. task-1·task-3과 수정 파일이 겹치지 않아 병렬 작성할 수 있다. 이 task는 테스트 작성 역할이다. 승인된 계약으로 테스트와 필요한 지원 코드만 작성한다. 제품 코드·제품 API 문서를 수정하지 않는다. 아래 checks는 파일 문법·JSON 파싱만 검사하며 모듈을 로드하거나 테스트·HTTP·DB fixture를 실행하지 않는다. 구현 전 동작 테스트 또는 예상 실패 확인을 하지 않는다. 작성 완료를 기능 검증 통과로 보고하지 않는다. 다른 작업자가 함께 작업하므로 타인의 변경을 되돌리지 않고 아래 파일만 apply_patch로 수정한다.

### 정확한 수정 허용 파일

~~~text
front/tests/unit/watchHistory.test.ts
front/tests/unit/libraryScreen.test.ts
front/tests/unit/savedVideos.test.ts
~~~


### 승인된 계약과 테스트 작성

- 새 front/src/features/playback/watchHistory.ts는 getWatchHistory(page=1)를 export하고 기존 sessionClient의 필수 인증으로 GET /me/watch-history?page=<page>를 호출한다.
- 반환값은 items/page/hasNext다. item은 videoUuid/contentType/dramaUuid/dramaTitle/imageUrl/durationMs/episodeUuid/episodeNumber/episodeTitle과 ISO UTC lastPlayedAt을 가진다. PREVIEW의 회차 필드는 null이며 savedAt·진행률·완료 상태를 추가하지 않는다.
- 새 WatchHistoryItem/WatchHistoryPage 타입은 playbackResponses.ts에 정의된다. 기존 savedVideoRoute는 저장 항목과 시청기록 항목에 같은 본편/프리뷰 경로를 반환한다. 계획된 모듈/타입을 테스트 코드에서 참조할 수 있지만 task-6 구현 전 로드하거나 전체 typecheck하지 않는다.
- libraryScreen harness에 저장/시청기록 요청 배열과 page 기록을 구분하고, setup(initialTab?: string)으로 직접 history 진입을 주입한다. setSession·render·settle·find의 기존 흐름을 유지하고 실제 Pressable 이벤트로 탭을 전환한다.
- 익명/복원 중 비노출, 카드·이동·길이·이미지 유지, 탭/사용자/세션/포커스별 늦은 응답 무효화는 승인된 plan.md 범위를 따른다. 시청기록 안내 문구는 task-6의 제품 계약과 아래 문구를 사용한다: 로딩 '시청 기록을 불러오는 중이에요', 오류 '시청 기록을 불러오지 못했어요', 빈 목록 '시청 기록이 없어요', 로그인 설명 '시청 기록을 보려면 로그인해 주세요.', 빈 설명 '영상을 시청하면 이곳에 표시돼요.'.

### 검증·테스트 매핑

- watchHistory.test.ts: 비로그인 호출 차단, 필수 Bearer 인증, 기본/다음 page URL, 정확한 items/page/hasNext와 lastPlayedAt 보존을 sessionClient의 실제 호출 경로에서 검사한다.
- libraryScreen.test.ts: 기존 'history disconnected' 기대를 새 계약으로 교체한다. 저장 탭은 저장 API만, 시청기록 탭과 직접 history 진입은 기록 API만 호출하는지 확인한다. 빈 목록·본편/프리뷰 카드·동일 이동·길이/이미지 표시·포커스 재조회도 검사한다.
- 첫 페이지 실패 후 재시도, 다음 페이지 실패 후 같은 page 재시도, endReached 중복 호출, 페이지 간 중복 videoUuid, 탭 전환 중 미완료 요청/늦은 오류, 다른 계정/로그아웃·세션 복원 중 기존 카드 비노출을 확인한다.
- savedVideos.test.ts: 기존 저장/삭제·필수 인증 assertions를 유지하고 lastPlayedAt이 있는 본편/프리뷰 항목도 동일 savedVideoRoute로 이동하는지 확인한다. API GET이 이동·시청기록 쓰기를 임의로 수행하지 않는지 검사한다.



### 주요 로직 코드 또는 변경 예시

setup('history')가 expo-router의 tab='history'를 제공하고 historyRequests는 가짜 getWatchHistory 호출만 수집하도록 기존 harness를 확장한다. 이 mock은 요청을 기록하고 deferred 응답을 돌려줄 뿐 탭 선택·재시도·오래된 응답 차단을 대신 구현하지 않는다. 아래 테스트와 별도로 지연 resolve/reject/finally·동일 page 재시도·중복 videoUuid 시나리오를 작성한다.

~~~ts
test('history entry loads history cards and preserves preview navigation', async () => {
  const screen = setup('history');
  screen.setSession({ uuid: 'account-a' }, false, 1);
  screen.render();
  assert.equal(screen.requests.length, 0);
  assert.equal(screen.historyRequests.length, 1);
  const historyItem = {
    videoUuid: 'history-preview-1', contentType: 'PREVIEW',
    lastPlayedAt: '2026-11-03T00:00:00.000Z',
    dramaUuid: 'drama-1', dramaTitle: '작품', imageUrl: null, durationMs: 60000,
    episodeUuid: null, episodeNumber: null, episodeTitle: null,
  };
  screen.historyRequests[0].resolve(page([historyItem]));
  await screen.settle();
  const list = screen.find(screen.tree, 'FlatList')[0];
  assert.equal(list.props.data.length, 1);
  assert.equal(list.props.data[0].videoUuid, historyItem.videoUuid);
  list.props.renderItem({ item: historyItem }).props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(screen.routes)), [{
    pathname: '/preview/[dramaId]/[videoId]',
    params: { dramaId: 'drama-1', videoId: 'history-preview-1' },
  }]);
});
~~~

watchHistory.test.ts는 실제 configureSessionClient와 fake fetch를 사용해 비로그인 차단·Bearer·page URL·응답 보존을 검사한다. savedVideos.test.ts의 기존 저장/삭제 assertions를 그대로 유지하면서 lastPlayedAt 항목의 이동을 추가한다.

### 검증 명령

~~~text
node --check front/tests/unit/watchHistory.test.ts
node --check front/tests/unit/libraryScreen.test.ts
node --check front/tests/unit/savedVideos.test.ts
~~~


### 완료 조건

- 조회 클라이언트·탭별 API·카드/이동·빈 목록/오류/재시도/중복·늦은 응답/로그아웃/세션 복원 시나리오를 계약과 대조해 검토한다.
- 소스 task-6에서 새 모듈을 구현한 뒤 실행할 수 있도록 가짜 HTTP/화면 이벤트 테스트를 작성하고 node --check 정적 검사만 통과한다.
- 타입 의미 검사·화면 실행·동작 테스트는 하지 않는다. 실제 선택 테스트와 최종 프론트 typecheck 담당이 task-6임을 완료 요약에 기록한다.

### 반복 작업 위임

불가. 인증·탭 전환·요청 수명·이동에 서로 다른 mock과 검증 판단이 필요하다. 담당 worker가 작성·정적 검사·계약 검토를 맡으며 하위 슬롯은 0개다.
