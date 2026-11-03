# task-4-preview-watch-recording

## 읽어야 할 파일

- AGENTS.md, front/AGENTS.md, _docs/ARCHITECTURE.md의 프론트·Harness 규칙
- 이 폴더의 plan.md, index.json의 task-4 항목, task-3의 완료 요약
- front/src/screens/RecommendationScreen.tsx, playbackScreen_preview.tsx의 player·포커스·구독 수명
- front/src/screens/playbackScreen_episode.tsx의 실제 재생 샘플 검사·tracker 정리 구간
- front/src/features/playback/watchProgress.ts, previewPlayback.ts, playbackResponses.ts, recommendationPreviewBuffer.ts의 직접 사용하는 인터페이스
- front/src/features/user/UserProvider.tsx의 세션/복원 인터페이스
- _docs/api/04-playback/watch-progress.md
- _docs/api/00-overview/error-code.md는 오류 처리를 확인할 때 참고한다.
- 구현 전 공식 문서: https://docs.expo.dev/versions/v57.0.0/ , https://docs.expo.dev/versions/v57.0.0/sdk/video/ , https://docs.expo.dev/versions/v57.0.0/sdk/router/
- 구현 시 적용되는 .agents/skills/vercel-react-native-skills/SKILL.md

## 실패 시 참고할 파일

- front/tests/unit/recommendationPreviewBuffer.test.ts, savedVideoScreens.test.ts
- front/tests/unit/watchProgress.test.ts, playbackScreenEpisode.test.ts
- front/src/features/user/sessionClient.ts의 실패 관련 경로

## 작업

depends_on은 task-3이다. 기존 PUT API가 프리뷰를 지원하므로 task-2의 새 GET 구현과 독립적으로 진행할 수 있다. 이 task는 소스 구현 및 테스트 실행 역할이다. 선행 테스트 task의 파일은 읽기 전용이며, 테스트를 임의 수정하거나 assertion을 약화해 통과시키지 않는다. 테스트 결함은 근거와 함께 별도 수정 범위로 보고한다. 담당 제품 코드를 구현한 뒤 아래 checks를 모두 실행·통과해야 완료한다. 테스트 내부는 실패 분석에 필요한 부분만 읽고, 실행만을 위해 전체를 읽지 않는다. 다른 작업자가 함께 작업하므로 타인의 변경을 되돌리지 않고 아래 파일만 apply_patch로 수정한다.

### 정확한 수정 허용 파일

~~~text
front/src/screens/RecommendationScreen.tsx
front/src/screens/playbackScreen_preview.tsx
~~~


공통 tracker·버퍼·본편 화면·응답 타입은 읽기 전용이다. 새로운 전역 상태·범용 hook·설정 옵션을 만들지 않는다.

### 구현 지시

1. 두 화면에 기존 createWatchProgressTracker와 saveWatchProgress를 import한다. tracker는 영상/세션/실제 재생 활성화 구간에 속하고 재생 UI 상태·저장 버튼·포스터 메타데이터 갱신으로 다시 생성되지 않는다.
2. 미리보기 화면은 getPreviewPlayback이 반환한 playback.videoUuid와 playback.durationMs를 PreviewVideo에 전달한다. 현재 videoId와 일치하는 실제 영상에 기록하며 작품 UUID나 첫 미리보기 UUID를 대신 쓰지 않는다. 기존 저장 버튼의 선택 영상과 이동 계약을 유지한다.
3. 추천은 현재 commit된 활성 카드의 선택 프리뷰 UUID와 서버 메타데이터의 preview.durationMs를 사용한다. RecommendationPreviewPlayer가 현재 선택된 player에만 마운트되는 기존 조건을 활용한다. 인접 entry를 retain/load/create한 시점, 재생 URL을 받은 시점, VideoView를 사전 마운트한 시점에는 기록하지 않는다.
4. timeUpdate마다 현재 포커스·세션·선택 영상·player의 playing/readyToPlay·seeking·이동 중 여부를 확인한다. 실제 증가하는 인접 샘플을 확인한 후 tracker.onProgress를 호출한다. 본편의 샘플 검사와 같은 상한 Math.max(2, playbackRate * 2)로 탐색 점프만의 기록을 막는다.
5. positionMs는 Math.floor(currentTime * 1000)을 0..서버 durationMs 범위로 제한한다. UI가 표시하는 player.duration 대신 API/서버 메타데이터의 durationMs로 완료 임계값을 계산한다.
6. playingChange/statusChange, 탐색 시작·완료, 비활성화 시 이전 샘플을 초기화한다. 2/3 이상으로 탐색한 것만으로 완료를 보내지 않으며 이후 정상 실제 재생 진행 샘플에서 완료를 보낼 수 있다.
7. 익명·복원 중·버퍼링·정지·잘못된 길이는 기록하지 않는다. 포커스 이탈과 영상/사용자/세션 변경 시 tracker.dispose와 리스너 해제를 수행해 대기 중 재시도·늦은 이벤트가 다른 영상/사용자에게 기록되지 않게 한다.
8. 추천의 리스너는 기존 trackListener/buffer.trackSubscription 경로를 사용해 entry eviction 전에 정리되게 한다. props의 inline trackListener 함수 참조 변화로 effect가 매 렌더마다 재설치되지 않도록 안정적인 ref 또는 동등한 최소 연결을 사용한다. 버퍼 파일 자체는 바꾸지 않는다.
9. 추천의 이동 중 가드는 최신 moving ref로 검사하되 moving의 매 변경마다 tracker를 폐기·재생성해 STARTED를 반복 전송하지 않는다. 기존 activeId·실제 도착 후 player 선택·포커스 조건을 유지한다.
10. tracker가 STARTED→COMPLETED를 직렬 전송하고 일시 네트워크/5xx에 제한된 재시도를 수행하는 기존 규칙을 재사용한다. 기록 실패를 새 모달·자동 로그인 이동·재생 중단으로 바꾸지 않는다. 기존 공통 세션 클라이언트가 인증 갱신을 처리한다.
11. 영상 재방문/새 재생 활성화 구간에는 STARTED로 최근 시청 시각을 갱신할 수 있다. 같은 활성화 구간의 반복 timeUpdate/저장 상태 갱신/메타데이터 갱신은 STARTED·COMPLETED를 중복 전송하지 않는다. 기록은 API의 사용자/영상 upsert로 한 항목을 유지한다.


### 주요 로직 코드 또는 변경 예시

추천의 RecommendationPreviewPlayer 내부 연결 예시다. 기존 seeking ref와 preview, player, session 필드를 사용한다. 두 화면에서 별도 파일로 새 추상화를 만들지 말고 해당 수명에 맞게 연결한다. 미리보기 화면은 같은 샘플 흐름에서 moving 조건과 buffer용 trackListener 래핑을 제외한다.

~~~tsx
const previewUuid = preview?.uuid;
const durationMs = preview?.durationMs ?? 0;
const movingRef = useRef(moving);
movingRef.current = moving;
const trackListenerRef = useRef(trackListener);
trackListenerRef.current = trackListener;
const previousPlaybackTime = useRef<number | null>(null);

useFocusEffect(useCallback(() => {
  if (isRestoring || !user || !previewUuid || durationMs <= 0) return;
  let active = true;
  const version = sessionVersion;
  const tracker = createWatchProgressTracker(
    (input) => saveWatchProgress(previewUuid, input),
    () => active && isCurrentSession(version),
  );
  const resetSample = () => { previousPlaybackTime.current = null; };
  resetSample();
  const time = trackListenerRef.current(player.addListener('timeUpdate', ({ currentTime }) => {
    if (!active || !isCurrentSession(version) || movingRef.current ||
        !player.playing || player.status !== 'readyToPlay' ||
        seeking.current || !Number.isFinite(currentTime)) {
      resetSample();
      return;
    }
    const previous = previousPlaybackTime.current;
    previousPlaybackTime.current = currentTime;
    if (previous === null || currentTime <= previous) return;
    if (currentTime - previous > Math.max(2, player.playbackRate * 2)) return;
    const positionMs = Math.min(durationMs, Math.max(0, Math.floor(currentTime * 1000)));
    tracker.onProgress(positionMs, durationMs);
  }));
  const playing = trackListenerRef.current(player.addListener('playingChange', resetSample));
  const status = trackListenerRef.current(player.addListener('statusChange', resetSample));
  return () => {
    active = false;
    tracker.dispose();
    time.remove();
    playing.remove();
    status.remove();
    resetSample();
  };
}, [
  player, previewUuid, durationMs, isRestoring, user?.uuid,
  sessionVersion, isCurrentSession,
]));
~~~

각 슬라이더의 기존 onSlidingStart와 onSlidingComplete에서는 seeking 변경에 더해 previousPlaybackTime.current = null을 설정한다. 기존 컨트롤 동작과 코드 스타일을 유지한다.

미리보기 전달 지점의 변경 예시다. 기존 URL·저장 상태·버튼 props는 그대로 두고 기록 식별자/길이만 전달한다.

~~~tsx
return <PreviewVideo
  key={(user?.uuid ?? 'anonymous') + ':' + sessionVersion + ':' + videoId}
  drama={state.drama}
  url={state.playback.url}
  videoId={state.playback.videoUuid}
  durationMs={state.playback.durationMs}
  initialSaved={state.playback.isSaved}
  savedWrites={savedWrites.current}
  onSavedChange={updateSaved}
  onClose={back}
/>;
~~~

PreviewVideo props에 durationMs: number를 추가한다. useFocusEffect에서 위 tracker를 videoId/durationMs에 연결하고 직접 player.addListener한 구독을 모두 해제한다. 기존 blur의 pause와 controls 타이머 정리를 유지한다. 새 focus 기록 구간을 열어도 사용자가 일시정지한 player를 임의로 play하지 않는다.


### 검증 책임

task-3이 작성한 두 화면 테스트와 기존 tracker·본편 테스트를 실행한다. 실제 선택 영상의 STARTED/COMPLETED·정확한 서버 길이/UUID·중복/탐색/사전 로딩 배제·수명 정리를 검증한다. 테스트 파일 작성이나 mock 변경은 이 task의 수정 범위가 아니다.

### 검증 명령

~~~text
npm --prefix front run test -- tests/unit/recommendationPreviewBuffer.test.ts tests/unit/savedVideoScreens.test.ts tests/unit/watchProgress.test.ts tests/unit/playbackScreenEpisode.test.ts
~~~


실서버·실제 미디어 다운로드가 필요 없는 선택 테스트다. task-2의 API 출력/DB fixture와 독립적이다. front/scripts/test-front.cjs는 선택 파일만 컴파일하고 실행별 임시 폴더를 사용하므로 task-5가 아직 작성 중인 보관함 테스트를 로드하지 않는다. 전체 프론트 typecheck는 task-6에서 두 프론트 소스 변경이 안정된 뒤 수행한다.

### 완료 조건

- 추천 및 선택 미리보기 영상 모두 실제 재생으로 미완료 기록을 남기고 2/3 완료를 저장한다. 기록 요청은 사용자/영상/서버 길이가 정확하다.
- 사전 로딩·일시정지·버퍼링·비활성·복원/익명·탐색만으로는 전송하지 않는다. 기존 player와 저장 버튼·이동을 보존한다.
- route/계정/세션/포커스 변경 시 이전 기록 작업·리스너·재시도가 정리되며 선언된 checks를 모두 통과한다.
- Expo SDK 57과 video/router 버전 문서를 읽고 현재 설치된 패키지 타입과 이벤트 API를 맞춘다. 브라우저 검증을 추가하면 기존 8081 서버를 사용하고, 서버가 없으면 npm --prefix front run start -- --port 8081을 안내하며 해당 검증을 실패로 기록한다.


### 반복 작업 위임

불가. 추천의 버퍼·스와이프 commit·구독 추적과 미리보기의 route·포커스 수명에 각각 판단이 필요하다. 담당 worker가 두 소스 파일 통합·모든 checks·최종 보고를 맡으며 하위 슬롯은 0개다.
