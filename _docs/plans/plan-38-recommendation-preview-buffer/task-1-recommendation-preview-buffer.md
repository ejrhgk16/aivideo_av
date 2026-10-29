# task-1-recommendation-preview-buffer

## 읽어야 할 파일
- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-38-recommendation-preview-buffer/plan.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/features/playback/previewPlayback.ts`
- `front/src/features/home/homeContent.ts`
- `front/tests/unit/previewPlayback.test.ts`
- `front/tests/unit/playbackScreenEpisode.test.ts`
- `front/scripts/test-front.cjs`
- Expo 57 영상 문서: https://docs.expo.dev/versions/v57.0.0/sdk/video/
- 필요 시 설치된 `expo-video`의 `VideoPlayer` 타입과 `VideoPlayer.web.tsx`, `VideoView.web.tsx` 구현. 라이브러리 파일은 수정하지 않는다.

## 작업
추천 피드의 이전·현재·다음 영상에 서명 URL과 플레이어를 준비하고, 인접 범위 안의 플레이어 및 버퍼를 페이지 이동 후에도 재사용한다.

### 수정 책임과 정확한 파일 범위
이 task의 worker는 다음 4개 파일만 수정한다. 다른 작업자의 변경을 되돌리지 말고 기존 변경을 반영한다.
- `front/src/features/playback/recommendationPreviewBuffer.ts` (신규): 추천 전용 URL 요청·플레이어 소유 및 인접 범위 갱신.
- `front/src/screens/RecommendationScreen.tsx`: 보관 상태를 화면에 연결하고 플레이어/영상 요소 수명과 스크롤·focus 이벤트를 조정.
- `front/tests/unit/recommendationPreviewBuffer.test.ts` (신규): 제어 가능한 요청·fake player 및 화면 이벤트 회귀 테스트.
- `front/scripts/test-front.cjs`: 기존 `testFiles` 배열에 `tests/unit/recommendationPreviewBuffer.test.ts` 등록. 실행기를 리팩토링하지 않는다.

### 구현 요구
1. 기존 `getPreviewPlayback(dramaId, videoId)`를 그대로 사용한다. 실제 API 호출 함수와 플레이어 생성 함수를 상태 관리 함수에 전달해 Node 테스트에서 실제 네트워크·네이티브 런타임 없이 검증한다. 필요 이상의 공용 캐시 계층이나 설정은 만들지 않는다.
2. 마지막 확정 페이지와 실제 재생 허용 여부를 분리한다. 현재 코드처럼 스크롤 시 `activeId=null`로 전체 보관 상태를 비우지 않는다. 화면 focus 상태에서 최대 이전·현재·다음 3개만 보관한다. 첫·마지막 페이지와 빈 목록 경계를 처리한다.
3. 보관 키는 작품 UUID와 preview UUID 조합으로 판단한다. 같은 키의 loading/ready/unavailable 항목은 범위 안에서 재요청하지 않는다. 범위 밖은 먼저 제거한 다음 새 항목을 추가해 순간적으로도 3개를 넘기지 않는다.
4. 요청 항목을 응답 전에 등록해 중복 요청을 방지한다. 보관 entries와 별도로 focus 수명의 `inFlight` Map에 작품 UUID·preview UUID별 진행 중 Promise를 기록한다. 요청 완료 전에 범위 밖으로 나갔다 돌아와도 같은 Promise를 공유하고 HTTP를 다시 호출하지 않는다. 응답 도착 시 각 콜백은 자신이 속한 항목이 아직 보관 중인지 확인한다. 제거된 항목의 예전 콜백은 새 항목을 덮어쓰지 못하며, 공유 Promise를 구독한 현재 항목의 콜백만 적용할 수 있다. 완료된 Promise는 성공·실패 모두 Map에서 제거하고 완료 URL을 별도 영구 캐시하지 않는다. 요청 실패와 preview 없음은 포스터로 대체하고 자동 무한 재시도를 하지 않는다. focus 이탈 후에는 예전 Map·콜백을 폐기한다. 이미 전송된 HTTP의 서버 처리를 취소한다고 가정하지 않는다.
5. 실제 `createVideoPlayer(url)`를 준비하되 인접 영상에서 `play()`를 호출하지 않는다. 직접 생성한 플레이어의 pause, 이벤트 리스너 제거, release 책임은 상태 관리자가 갖는다. 이미 해제된 플레이어를 화면 cleanup이 다시 조작하지 않게 한다.
6. 네이티브에서는 화면에 연결되지 않은 플레이어로도 선로딩할 수 있지만 웹은 HTML 영상 요소가 필요하다. 추천 화면에서 보관된 영상의 `VideoView`를 안정적인 키로 유지하는 레이어를 FlatList 가상화와 분리한다. 활성 영상만 표시하고 나머지는 숨김·비대화형·정지 상태로 유지한다. 활성 전환 시 기존 View를 제거하고 새로 만드는 구조를 피한다. `display:none`에 의존해 브라우저가 로드를 생략하지 않는지도 확인한다.
7. `RecommendationPreviewPlayer`는 보관된 플레이어를 전달받아 컨트롤을 연결한다. 내부 `useVideoPlayer(url, play)`를 제거해 이중 플레이어 생성을 막는다. 기존 `VideoView`는 보관 레이어로 옮겨 플레이어당 하나만 연결한다. 컨트롤 컴포넌트 cleanup은 자신이 등록한 리스너·타이머만 정리하며 플레이어를 release하지 않는다.
8. 다른 영상으로 페이지 이동이 확정되면 기존 활성 영상을 `pause()`한 뒤 `currentTime = 0`으로 초기화한다. 이는 선택 사항이 아니라 필수 동작이다. 인접 범위 안의 기존 플레이어·서명 URL·남아 있는 버퍼는 유지하며 다시 돌아오면 같은 플레이어로 처음부터 재생한다. 아직 seek할 수 없는 상태라면 해당 플레이어의 준비 시점에 0초 초기화를 반영하되 비활성 영상은 재생하지 않는다. 스크롤 시작은 pause만 수행하고, 스크롤 취소나 같은 페이지의 중복 settle에서는 재생 위치를 초기화하지 않는다. 불필요한 URL 요청·플레이어 재생성을 하지 않으며 같은 페이지의 중복 settle 이벤트나 인접 URL 응답 때문에 사용자가 누른 일시정지가 해제되지 않게 한다.
9. 영상 객체 준비와 실제 readyToPlay를 구분한다. View 연결 후 재생 가능한 상태에서 현재 확정 페이지·focus·스크롤 여부를 다시 확인해 재생한다. 늦게 ready가 된 이전 영상이 소리를 내지 않게 한다. 초기 이벤트 구독 전에 ready/error가 된 플레이어의 현재 status도 확인한다. 웹 자동 재생 제한이 있으면 기존 재생 버튼을 통한 사용자 재생을 유지하고 임의로 무음 정책을 추가하지 않는다.
10. focus 이탈/unmount 시 화면이 보관 View·컨트롤을 먼저 분리하고 전체 플레이어·리스너·요청 항목·settle 타이머를 정리한다. 늦게 끝난 요청은 플레이어를 생성하거나 상태를 되살리지 않는다. focus 복귀는 마지막 페이지 주변을 새로 준비한다. React effect cleanup/재실행에서도 중복 객체와 해제된 참조가 남지 않게 한다.
11. 기존 목록 정렬과 initialId, 웹 스크롤 debounce 및 native momentum 처리, 포스터 대체 화면, 구매·회차·공유·저장·재생 컨트롤은 유지한다. 작품 상세 API의 전체 선로딩 등 승인 범위 밖 최적화를 추가하지 않는다.
12. 목록 순서·마지막 확정 ID·focus 세대는 화면 이벤트 시점의 최신 ref로 판단한다. `onScroll`마다 URL을 요청하지 않고 페이지 확정 후 인접 범위를 갱신한다. settle 타이머는 최신 스크롤 세대와 offset을 확인하고, 새 드래그·momentum 확정·blur 시 예전 타이머를 무효화한다. URL 응답에서는 settledId를 바꾸거나 직접 play하지 않는다. 재생 직전에 최신 focus·scroll·활성 키·플레이어 동일성을 확인한다. 따라서 늦은 응답이 최신 페이지를 덮어쓰거나 기존 영상이 뒤늦게 재생될 수 없다.

### 주요 로직 코드 또는 변경 예시
아래는 인접 범위 갱신과 비동기 응답의 핵심 흐름이다. 실제 타입과 React 연결은 위 요구에 맞춰 완성한다. 플레이어 직접 import는 화면 경계에 두고 상태 관리에는 필요한 작은 메서드 계약을 사용하면 기존 Node 테스트 실행 방식을 유지할 수 있다.

```ts
type PreviewTarget = { dramaId: string; videoId: string };
type BufferedPlayer = {
  pause(): void;
  release(): void;
};
type Entry<P> = {
  target: PreviewTarget;
  kind: 'loading' | 'ready' | 'unavailable';
  player?: P;
};

export function createRecommendationPreviewBuffer<P extends BufferedPlayer>(
  load: (dramaId: string, videoId: string) => Promise<{ url: string }>,
  create: (url: string) => P,
  changed: () => void,
) {
  const entries = new Map<string, Entry<P>>();
  const inFlight = new Map<string, Promise<{ url: string }>>();
  const keyOf = (target: PreviewTarget) => JSON.stringify([target.dramaId, target.videoId]);
  let disposed = false;

  function loadOnce(target: PreviewTarget) {
    const key = keyOf(target);
    const existing = inFlight.get(key);
    if (existing) return existing;
    const request = load(target.dramaId, target.videoId);
    inFlight.set(key, request);
    const clear = () => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    };
    void request.then(clear, clear);
    return request;
  }

  function retain(targets: PreviewTarget[]) {
    if (disposed) return;
    const keep = new Set(targets.map(keyOf));
    for (const [key, entry] of entries) {
      if (keep.has(key)) continue;
      entries.delete(key);
      entry.player?.pause();
      entry.player?.release();
    }
    for (const target of targets) {
      const key = keyOf(target);
      if (entries.has(key)) continue;
      const entry: Entry<P> = { target, kind: 'loading' };
      entries.set(key, entry);
      void loadOnce(target).then(({ url }) => {
        if (disposed || entries.get(key) !== entry) return;
        entry.player = create(url);
        entry.kind = 'ready';
        changed();
      }).catch(() => {
        if (disposed || entries.get(key) !== entry) return;
        entry.kind = 'unavailable';
        changed();
      });
    }
    changed();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const entry of entries.values()) {
      entry.player?.pause();
      entry.player?.release();
    }
    entries.clear();
    inFlight.clear();
  }

  return { retain, dispose, snapshot: () => [...entries.values()] };
}
```

위 `kind: 'ready'`는 URL 수신·플레이어 객체 생성 완료를 의미한다. 실제 구현에서는 혼동을 줄이는 이름으로 바꿔도 되며, 실제 재생 준비 상태는 반드시 `player.status`로 판단한다.

화면 호출·표시의 주요 흐름은 다음과 같다. 매 render 새로 만든 배열을 effect 의존성에 넣어 retain을 무한 반복하지 않도록, 정렬된 목록과 마지막 확정 페이지에서 안정적인 범위를 만든다. 아래 `buffer`는 focus마다 생성되고 cleanup에서 폐기되는 동일 인스턴스를 가리킨다.

```tsx
const index = dramas.findIndex((drama) => drama.uuid === settledId);
const targets = index < 0 ? [] : dramas
  .slice(Math.max(0, index - 1), index + 2)
  .flatMap((drama) => {
    const preview = drama.previewVideos[0];
    return preview ? [{ dramaId: drama.uuid, videoId: preview.uuid }] : [];
  });
buffer.retain(targets);

const beginScroll = () => {
  setScrolling(true);
  for (const entry of buffer.snapshot()) entry.player?.pause();
};

const finishScroll = (offsetY: number) => {
  if (cardHeight <= 0 || dramas.length === 0) return;
  const page = Math.max(0, Math.min(dramas.length - 1, Math.round(offsetY / cardHeight)));
  const nextId = dramas[page].uuid;
  if (nextId !== settledId) {
    const previous = buffer.snapshot().find((entry) => entry.target.dramaId === settledId);
    if (previous?.player) {
      previous.player.pause();
      previous.player.currentTime = 0;
    }
    setSettledId(nextId);
  }
  setScrolling(false);
};

// FlatList의 형제 레이어에 보관 범위 안의 동일 View를 유지한다.
const videoLayer = snapshot.flatMap((entry) => entry.player ? [
  <VideoView
    key={JSON.stringify([entry.target.dramaId, entry.target.videoId])}
    player={entry.player}
    nativeControls={false}
    contentFit="contain"
    pointerEvents="none"
    style={[
      StyleSheet.absoluteFill,
      styles.playerVideo,
      { opacity: screenFocused && !scrolling && entry.target.dramaId === settledId ? 1 : 0 },
    ]}
  />,
] : []);
```

위 화면 예시는 effect·렌더 내부 배치를 생략한 데이터 흐름 예시다. 실제 `retain`은 effect/focus 이벤트에서 호출하고 render 중 상태를 변경하지 않는다. 표시 레이어는 기존 포스터와 활성 컨트롤 사이에 배치해 UI를 가리지 않게 한다. 별도 활성 재생 effect에서 전환 시 비활성 플레이어를 pause하고 활성 플레이어만 ready 상태 확인 후 play한다. statusChange 콜백은 최신 focus·scroll·활성 키를 확인한다. View와 컨트롤의 분리 및 release 순서는 실제 React cleanup 순서까지 검증한다.

활성 플레이어가 실제 준비됐을 때 한 번만 자동 재생하는 흐름은 아래와 같다. `activePlayer`는 현재 확정 작품의 보관 객체이며, 인접 항목 응답으로 바뀌지 않는 참조여야 한다. `playbackGate`는 스크롤 시작·focus 이탈 이벤트에서도 즉시 갱신하는 ref다. 보관 상태 관리자가 pause/release를 소유하며 effect cleanup은 구독만 제거한다. 이 예시에 오류를 포스터로 전환하는 처리와 비활성 영상 정리 흐름을 함께 연결한다.

```tsx
useEffect(() => {
  if (!activePlayer || !screenFocused || scrolling) return;
  const player = activePlayer;
  let live = true;
  let started = false;
  const startWhenReady = () => {
    const gate = playbackGate.current;
    if (!live || started || !gate.focused || gate.scrolling) return;
    if (gate.player !== player || player.status !== 'readyToPlay') return;
    started = true;
    player.play();
  };
  const subscription = player.addListener('statusChange', startWhenReady);
  startWhenReady();
  return () => {
    live = false;
    subscription.remove();
  };
}, [activePlayer, screenFocused, scrolling]);
```

위 예시처럼 `started`는 인접 URL 응답이나 buffering→ready 이벤트에서 사용자 일시정지를 해제하지 않도록 한다. 재생 위치 초기화는 위 `finishScroll`의 실제 페이지 변경 시점에 수행하고, 재생 effect에서는 위치를 바꾸지 않는다. 그래야 스크롤 취소로 같은 페이지에 복귀할 때 위치를 보존한다. 실제 구현에서는 마지막 확정 ID를 ref로도 추적해 동일 페이지의 중복 이벤트가 초기화를 반복하지 않게 한다. 아직 준비되지 않은 플레이어의 0초 초기화는 요구 8의 준비 이벤트 흐름에 연결한다. 실제 release는 화면에 남아 있는 참조·구독의 분리와 조율한다. 앞선 상태 관리 예시의 즉시 release 부분은 이 수명 순서를 반영해 구현한다.

### 회귀 테스트
- 초기 1번 페이지는 1·2번만 요청하며 모두 준비돼도 1번만 재생한다.
- 1→2에서는 기존 1·2번 플레이어가 `===`로 동일하고 URL 재요청이 없으며 3번만 새로 요청한다.
- 1번의 재생 위치가 0보다 큰 상태에서 1→2로 이동하면 2번의 play 호출 전에 1번의 pause와 `currentTime = 0`이 반영된다. 1번을 해제·재생성하지 않고 0초 정지 상태로 보관한다.
- 2→1에서는 추가 요청 없이 기존 1번이 처음부터 재생되고 3번만 해제된다.
- 별도 연속 시나리오 1→2→3에서는 1번만 해제되고 2·3번을 유지하며 4번만 새로 요청한다.
- 스크롤 중 전부 pause하되 버퍼와 View는 유지한다. 같은 페이지로 돌아오는 취소와 중복 settle 이벤트는 currentTime을 초기화하지 않는다. 사용자의 일시정지를 인접 URL 응답이 해제하지 않는다.
- 요청을 미완료 상태로 둔 채 같은 페이지를 반복 확정하거나 1→2→1로 왕복해도 같은 키의 HTTP 요청은 1개뿐이다. 해당 키가 인접 범위 밖으로 나갔다 미완료 상태에서 재진입하는 경우도 Promise를 공유하고 현재 항목에 플레이어를 한 번만 생성한다.
- 빠른 이동 중 범위 밖 항목의 응답, 같은 키 재진입 전 제거된 항목의 콜백, blur/unmount 뒤 응답은 플레이어를 생성하거나 재생하지 않는다. 공유 요청은 현재 유효한 항목에만 적용된다.
- 1→2→3 이동 후 URL 응답을 3→2→1 등 역순으로 완료해도 마지막 확정 페이지가 유지되고 3번만 재생한다. 이전 플레이어의 늦은 ready/error 이벤트가 현재 영상 상태를 변경하지 않는다.
- 이전 드래그의 settle 콜백을 새 이동·momentum 확정·blur 뒤 실행해도 페이지가 과거 위치로 돌아가거나 중복 재생·초기화되지 않는다. 새 focus 뒤 예전 focus의 응답·이벤트도 적용되지 않는다.
- URL 요청 실패, preview 없음, 플레이어 error는 해당 포스터로 대체되고 다른 인접 영상 준비를 막지 않는다. 첫·마지막·빈 목록 경계를 검증한다.
- fake player에 ready/statusChange와 play/pause/release 기록을 두고 준비되지 않은 영상 및 비활성 영상의 play가 발생하지 않는지 확인한다. release는 객체당 한 번이며 리스너가 남지 않아야 한다.
- 기존 `playbackScreenEpisode.test.ts`의 transpile/VM 방식 등 저장소 패턴을 참고하여 같은 새 테스트 파일에서 화면을 로드하고 scroll/focus 이벤트와 보관 View의 안정적인 key·player 연결을 검증한다. 소스 문자열 포함 여부만으로 동작을 검증하지 않는다. fake DOM/네이티브 테스트를 실제 네트워크 버퍼링 검증으로 보고하지 않는다.

### 검증 명령
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

### 실화면 확인 및 완료 조건
- 실행 중인 8081 프론트·3000 백엔드에 HTTP로 연결되는지 먼저 확인한다. 실제 화면에서 1→2→1 재사용, 1→2→3 범위 이동, 빠른 스와이프, 스크롤 취소, 탭 이탈·복귀를 확인한다. 준비된 웹 영상 요소가 유지되고 한 영상만 재생되는지 확인한다.
- 서버가 없으면 실화면 확인을 실패로 기록하고 사용자에게 `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`를 안내한다. 에이전트가 서버를 실행하거나 다른 포트로 우회하지 않는다. 도구·장치가 없어 네이티브 검증을 수행하지 못했다면 그 제한을 명시한다.
- 자동 검사 3개 통과, 기존 영상의 페이지 이탈 시 pause·0초 초기화, 인접 범위 URL/플레이어 재사용 및 단일 영상 재생 회귀 통과, 범위 밖·화면 이탈 정리 확인이 완료 조건이다. 실화면 결과와 미검증 플랫폼·버퍼링 한계는 별도로 보고한다.
