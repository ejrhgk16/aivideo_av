# task-3-preview-watch-recording-tests

## 읽어야 할 파일

- AGENTS.md, front/AGENTS.md, _docs/ARCHITECTURE.md의 프론트·Harness 규칙
- 이 폴더의 plan.md의 기록 저장 계약·검증 매핑과 index.json의 task-3 항목
- front/tests/unit/recommendationPreviewBuffer.test.ts의 화면/player harness와 재생·포커스·버퍼 재사용 검사
- front/tests/unit/savedVideoScreens.test.ts의 previewScreen harness와 저장 버튼/일시정지 회귀 검사
- front/src/features/playback/watchProgress.ts의 createWatchProgressTracker·saveWatchProgress 공개 인터페이스
- _docs/api/04-playback/watch-progress.md
- 코드 작성 전 공식 버전 문서: https://docs.expo.dev/versions/v57.0.0/ 와 https://docs.expo.dev/versions/v57.0.0/sdk/video/

## 필요 시 참고할 파일

- front/src/screens/RecommendationScreen.tsx의 RecommendationPreviewPlayer·활성 player 선택·구독 연결 지점
- front/src/screens/playbackScreen_preview.tsx의 PreviewVideo props·선택 영상 전달 지점
- front/src/features/user/UserProvider.tsx의 세션 인터페이스
- 위 소스 전체나 보관함/API 구현 task는 필수 읽기 대상이 아니다.

## 작업

depends_on은 없다. task-1·task-5와 병렬 작성할 수 있다. 이 task는 테스트 작성 역할이다. 승인된 계약으로 테스트와 필요한 지원 코드만 작성한다. 제품 코드·제품 API 문서를 수정하지 않는다. 아래 checks는 파일 문법·JSON 파싱만 검사하며 모듈을 로드하거나 테스트·HTTP·DB fixture를 실행하지 않는다. 구현 전 동작 테스트 또는 예상 실패 확인을 하지 않는다. 작성 완료를 기능 검증 통과로 보고하지 않는다. 다른 작업자가 함께 작업하므로 타인의 변경을 되돌리지 않고 아래 파일만 apply_patch로 수정한다.

### 정확한 수정 허용 파일

~~~text
front/tests/unit/recommendationPreviewBuffer.test.ts
front/tests/unit/savedVideoScreens.test.ts
~~~


### 승인된 동작과 작성 지시

- 추천과 미리보기는 기존 PUT /me/videos/:videoUuid/watch-progress를 사용한다. 실제 재생 진행을 확인한 뒤 STARTED는 positionMs=0으로 한 번, 서버 durationMs의 2/3 이상에서 COMPLETED를 한 번 전송한다.
- durationMs=60000인 선택 프리뷰와 다른 player.duration을 fixture에 둬 서버 길이를 쓰는지 검증한다. 시작/완료 요청은 getPreviewPlayback 또는 선택 카드가 제공한 정확한 영상 UUID를 사용해야 한다.
- player 이벤트·세션·포커스·seeking·이동 상태를 입력으로 구동하고 실제 createWatchProgressTracker 또는 그 이벤트를 보존하는 mock으로 전송을 관찰한다. mock 자체가 기록 허용 여부를 판단하면 안 된다.

### 검증·테스트 매핑

- recommendationPreviewBuffer.test.ts의 기존 화면/player harness를 확장해 timeUpdate/playingChange/statusChange와 포커스·세션 변경을 구동한다. 버퍼의 URL 로딩·player 생성/사전 마운트만으로 기록되지 않는지 확인한다.
- 추천에서 활성 영상 A의 실제 진행은 A UUID로 STARTED 한 번, 2/3 도달은 COMPLETED 한 번만 보낸다. B 이동 중·인접 사전 로딩에서는 B 기록이 없고 실제 commit/재생 후 B로 전환한다. A 재방문·버퍼 재사용 시에도 현재 선택 영상만 기록한다.
- savedVideoScreens.test.ts의 기존 preview harness에서 실제 player 이벤트를 발생시키고 getPreviewPlayback이 반환하는 정확한 영상 UUID/서버 길이를 사용한다. 기존 테스트에 필요한 durationMs와 tracker 모듈 mock도 맞추되 저장 동작 assertion을 약화하지 않는다.
- 미리보기에서 STARTED만 전송한 시청, 완료 임계값 직전/도달, 반복 이벤트, 앞으로/뒤로 탐색, 일시정지, 버퍼링, blur, route/계정 변경을 검사한다. 이미 일시정지한 player가 저장 버튼이나 화면 메타데이터 변경으로 재생되지 않는 기존 검사를 유지한다.
- 테스트는 실제 createWatchProgressTracker 또는 이벤트를 보존한 mock으로 화면의 전송 연결을 검증한다. mock이 재생 조건을 대신 판단하거나 무조건 통과시키게 하지 않는다.
- 기존 watchProgress.test.ts와 playbackScreenEpisode.test.ts는 수정하지 않는다. task-4가 읽기 전용 회귀 테스트로 실행한다.


### 주요 로직 코드 또는 변경 예시

기존 previewScreen harness에 watchWrites 배열과 emitProgress(currentTime) 메서드를 추가한다. watchWrites는 실제 saveWatchProgress 호출의 videoUuid/event/positionMs를 수집하고, emitProgress는 가짜 player의 currentTime을 설정한 뒤 실제 등록된 timeUpdate 리스너를 호출한다. 아래 테스트는 선택 UUID preview-selected-1, 서버 길이 60000ms, player 길이 90초, 로그인·포커스·playing/readyToPlay 상태의 fixture를 사용한다. 테스트 코드만 작성하며 이 단계에서 실행하지 않는다.

~~~ts
test('preview records the selected video once at start and the server completion threshold', async () => {
  const screen = previewScreen();
  screen.render();
  await screen.settle();
  assert.deepEqual(screen.watchWrites, []);
  for (let second = 0; second <= 40; second += 1) {
    screen.emitProgress(second);
    await screen.settle();
  }
  assert.deepEqual(screen.watchWrites, [
    { videoUuid: 'preview-selected-1', event: 'STARTED', positionMs: 0 },
    { videoUuid: 'preview-selected-1', event: 'COMPLETED', positionMs: 40000 },
  ]);
  screen.emitProgress(41);
  await screen.settle();
  assert.equal(screen.watchWrites.length, 2);
});
~~~

위 fixture의 기본값을 기존 저장 버튼 테스트까지 깨뜨리지 않도록 개별 옵션으로 주입할 수 있다. 부정 시나리오는 별도 테스트로 작성하고, seeking만으로 임계값을 넘긴 경우 전송이 없음을 검사한 뒤 정상 진행 재개를 구분한다. 추천의 활성 A/B 전환·이동 중·사전 로딩·A 재방문·세션/blur 정리도 기존 이벤트 경로로 구동한다.

### 검증 명령

~~~text
node --check front/tests/unit/recommendationPreviewBuffer.test.ts
node --check front/tests/unit/savedVideoScreens.test.ts
~~~


### 완료 조건

- 재생 진행·서버 길이·정확한 UUID·중복 방지·익명/복원/일시정지/버퍼링/탐색/이동/사전 로딩 배제와 route·계정·포커스 정리 시나리오를 작성한다.
- 저장 버튼·사용자 일시정지·버퍼 재사용의 기존 assertion을 유지하고 계약과 대조해 검토한다.
- node --check는 TypeScript 문법만 확인하며 테스트를 실행하거나 새 화면 구현을 로드하지 않는다. 선택 기능 테스트는 task-4가 소스 구현 후 수행한다.
- 정적 checks 통과와 시나리오 검토를 보고하며 기능 검증 통과로 보고하지 않는다.

### 반복 작업 위임

불가. 추천 버퍼와 미리보기의 서로 다른 수명/이벤트 mock 설계가 필요하다. 담당 worker가 두 테스트 파일 작성·정적 검사·계약 검토를 맡으며 하위 슬롯은 0개다.
