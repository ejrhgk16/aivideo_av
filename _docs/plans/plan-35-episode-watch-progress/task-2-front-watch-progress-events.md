# task-2-front-watch-progress-events

## 읽어야 할 파일

- `AGENTS.md`, `front/AGENTS.md`, `_docs/ARCHITECTURE.md`
- `.agents/skills/vercel-react-native-skills/SKILL.md`
- `_docs/plans/plan-35-episode-watch-progress/plan.md`
- `_docs/api/04-playback/watch-progress.md` (task-1 결과)
- `front/src/screens/playbackScreen_episode.tsx`, `front/src/features/playback/episodePlayback.ts`
- `front/src/features/user/UserProvider.tsx`, `front/src/features/user/sessionClient.ts`, `front/src/common/http/api.ts`
- `front/tests/unit/playbackScreenEpisode.test.ts`, `front/tests/unit/episodePlayback.test.ts`, `front/scripts/test-front.cjs`
- 코드 작성 전 `front/AGENTS.md` 지침에 따라 Expo 57 공식 문서 `https://docs.expo.dev/versions/v57.0.0/` 및 해당 버전 expo-video 문서를 확인한다.

## 작업

task-1 완료 후 실행한다. 다른 작업자가 존재할 수 있으므로 다른 변경을 되돌리지 않는다. 수정 범위:

```text
front/src/screens/playbackScreen_episode.tsx
front/src/features/playback/watchProgress.ts
front/tests/unit/watchProgress.test.ts
front/tests/unit/playbackScreenEpisode.test.ts
front/scripts/test-front.cjs
```

`watchProgress.ts`에 required-auth PUT 호출과 해당 화면의 작은 이벤트 추적기를 둔다. 기존 공통 세션 클라이언트를 재사용하고 토큰·사용자 전역 상태·새 큐 라이브러리는 추가하지 않는다. 추적기는 React와 독립적으로 테스트 가능하게 하되 범용 프레임워크로 확장하지 않는다.

### 이벤트와 생명주기

- `PlaybackVideo`의 실제 플레이어 timeUpdate 이벤트에서 재생 중 연속된 시간 진행을 관찰한다. play 호출, playingChange=true, sourceLoad, currentTime 대입만으로 시작·완료를 보내지 않는다.
- 로그인 사용자이며 복원 완료·현재 세션일 때만 추적기를 만든다. 회차 id·사용자 uuid·세션 세대에 종속되며 변경 시 기존 추적기 dispose와 timer 정리를 수행한다.
- 슬라이더 시작/완료에서 기준 샘플을 초기화하고 seek 중 timeUpdate는 무시한다. seek 직후 첫 샘플은 기준만 잡고 이후 재생 진행을 확인한다. 일시정지·버퍼링·포커스 이탈에서도 기준을 초기화한다. 뒤로 이동한 delta나 불연속 큰 jump로 시청 시작을 판단하지 않는다.
- 이미 재생 중인 상태로 listener가 연결되는 경우도 다음 timeUpdate에서 정상 추적해야 한다. duration 기준은 `playback.durationMs`다. 0/비정상 길이는 저장하지 않는다. 기준 정보가 준비될 때 재생 위치를 저장하기 위해 새 영상 URL을 요청하지 않는다.
- 위치는 `Math.min(durationMs, Math.max(0, Math.floor(currentTime * 1000)))`로 전송한다. STARTED payload는 항상 0이다. 2/3 판정은 `positionMs * 3 >= durationMs * 2`이며 COMPLETED 위치는 판정 시점에 고정해 재시도에도 동일하게 보낸다.
- 시작 요청 처리 중 2/3에 도달하면 완료를 1개만 예약한다. 시작 요청의 성공/제한 재시도 종료 뒤 현재 세션이면 완료를 보낼 수 있다. 서버는 완료 요청만 도착해도 생성하므로 시작 저장 실패가 완료 저장을 영구히 막지 않는다.
- 같은 화면에서 시작/완료 각각 1개 논리 이벤트만 소비한다. 성공 여부만 flag로 쓰지 말고 pending·소진 상태까지 막아 고빈도 이벤트가 실패 후 무한 재전송을 만들지 않게 한다.
- 네트워크 TypeError 및 ApiError 5xx만 2초 뒤 1회 재시도한다. 4xx와 SessionChangedError는 추가 재시도하지 않는다. 세션 변경/로그아웃/화면 종료/회차 변경 시 timer와 미전송 이벤트를 취소한다. 포커스 이탈 시 기존 pause 처리와 샘플 초기화를 수행해 새 이벤트가 생기지 않게 한다. 이미 관찰해 예약된 저장은 같은 사용자·회차의 화면이 마운트된 동안 완료할 수 있다. 다시 포커스되면 기존 소비 상태를 보존하고 새 재생 진행만 관찰한다.
- 취소 전에 이미 서버에 전송된 요청은 취소됐다고 주장하지 않는다. 후속 처리·재시도만 막으며 각 요청 직전에 캡처한 세션의 유효성을 확인한다.
- 저장 실패는 영상 오류 UI로 전달하지 않고 기존 영상 재생을 유지한다. 미리보기는 변경하지 않는다.

### 주요 로직 코드 또는 변경 예시

아래는 이벤트별 단일 소비, 직렬 처리, 제한 재시도와 폐기의 핵심 예시다. 실제 player 연결은 위 이벤트 규칙에 따라 별도 구현한다. 테스트를 위한 타이머 제어는 Node fake timers 또는 테스트 환경에 맞는 최소 주입을 사용한다.

```ts
type ProgressInput = { event: 'STARTED' | 'COMPLETED'; positionMs: number };

export function saveWatchProgress(episodeId: string, input: ProgressInput) {
  return apiRequest<void>(`/me/episodes/${encodeURIComponent(episodeId)}/watch-progress`, {
    auth: 'required', method: 'PUT', json: input,
  });
}

export function createWatchProgressTracker(
  send: (input: ProgressInput) => Promise<void>,
  isCurrent: () => boolean,
) {
  let disposed = false;
  let started = false;
  let completed = false;
  let tail = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let releaseWait: (() => void) | undefined;
  const current = () => !disposed && isCurrent();

  function stopWaiting() {
    clearTimeout(timer);
    releaseWait?.();
    timer = undefined;
    releaseWait = undefined;
  }
  async function deliver(input: ProgressInput) {
    for (let attempt = 0; attempt < 2 && current(); attempt += 1) {
      try { await send(input); return; }
      catch (error) {
        const retryable = error instanceof TypeError ||
          (error instanceof ApiError && error.status >= 500 && error.status < 600);
        if (!retryable || attempt === 1 || !current()) return;
        await new Promise<void>((resolve) => {
          releaseWait = resolve;
          timer = setTimeout(() => {
            timer = undefined;
            releaseWait = undefined;
            resolve();
          }, 2000);
        });
      }
    }
  }
  function enqueue(input: ProgressInput) {
    tail = tail.then(() => current() ? deliver(input) : undefined);
  }
  return {
    onProgress(positionMs: number, durationMs: number) {
      if (!current() || !Number.isFinite(durationMs) || durationMs <= 0) return;
      if (!started) {
        started = true;
        enqueue({ event: 'STARTED', positionMs: 0 });
      }
      if (!completed && positionMs * 3 >= durationMs * 2) {
        completed = true;
        enqueue({ event: 'COMPLETED', positionMs });
      }
    },
    dispose() { disposed = true; stopWaiting(); },
  };
}
```

플레이어 호출 흐름 예시:

```ts
// effect는 episode id / user uuid / sessionVersion / player가 바뀌면 정리한다.
const tracker = createWatchProgressTracker(
  (input) => saveWatchProgress(id, input),
  () => isCurrentSession(version),
);
let previous: number | null = null;
const time = player.addListener('timeUpdate', ({ currentTime }) => {
  if (!player.playing || seeking.current || player.status !== 'readyToPlay' ||
      !Number.isFinite(currentTime)) { previous = null; return; }
  const last = previous;
  previous = currentTime;
  if (last === null || currentTime <= last) return;
  // 설정된 0.5초 업데이트와 현재 배속에 비해 큰 jump는 기준만 갱신한다.
  if (currentTime - last > Math.max(2, player.playbackRate * 2)) return;
  const positionMs = Math.min(playback.durationMs, Math.max(0, Math.floor(currentTime * 1000)));
  tracker.onProgress(positionMs, playback.durationMs);
});
// seek·일시정지·버퍼링 경계에서는 previous=null. cleanup: time.remove(), tracker.dispose().
```

이미 보낸 성공 이벤트를 포커스 복귀로 재전송하지 않는다. 위 코드는 핵심 흐름 예시이며 실제 React hook 순서와 플레이어 listener 정리는 기존 컴포넌트 생명주기에 맞춘다. import는 기존 `ApiError`, `apiRequest`를 사용한다. tracker는 세션·회차별 effect 안에서 생성해 같은 화면의 렌더마다 초기화되지 않게 한다.

### 테스트·정확한 설정 변경

- `front/scripts/test-front.cjs`의 기존 `testFiles` 배열에 `'tests/unit/watchProgress.test.ts'`를 추가한다. 나머지 실행기 구조는 수정하지 않는다. 이는 새 로직이 없는 목록 등록 변경이다.
- 새 테스트는 API method/path/required auth/body, 시작·완료 단일 소비, 연속 이벤트와 요청 중 중복, 직렬 순서, 완료 위치 고정, 2초 뒤 1회 재시도, 재시도 소진, 4xx 제외, 세션 변경/dispose/timer 정리를 검증한다.
- 화면 테스트에 실제 PlaybackVideo의 player listener를 구동할 수 있는 최소 mock을 확장한다. 소스 문자열 존재 검사만으로 이벤트 동작을 검증하지 않는다. 로딩 완료·play 호출만으로 0건, 실제 진행 시 시작 1건, 정지·재개·반복 seek로 시작 중복 없음, 정지 상태 seek로 완료 없음, seek 후 2/3 이상 재생 시 완료 1건, 완료 후 뒤로 이동해도 중복 없음, 비로그인 0건을 확인한다.
- 정확히 2/3 경계와 직전, 배속, 진행하지 않는 버퍼링, 회차/사용자/세션 변경, unmount 및 포커스 복귀를 포함한다. timer를 실제 2초씩 기다리지 않는다.
- 기존 세션/권한/화면 테스트를 보존한다. 테스트 작성에 필요한 모듈 mock은 새 import와 일치시킨다.

### 검증 명령과 완료 조건

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: 정상 재생 시작·2/3 이벤트의 저장 횟수가 화면/회차 기준 각각 1회이며 seek spam·재개·실패 시 고빈도 재요청이 없고, 비로그인·이전 세션 기록 전송을 막고, 저장 실패 중 영상 재생을 유지하며 세 checks 통과. task-1 API와 실제 저장 상태를 기존 개발 서버에서 확인할 경우 지정된 localhost:8081/3000만 사용한다. 서버가 없으면 검증 실패와 실행 명령을 안내하며 자동 실행하지 않는다. 범위 밖 파일이 필요하면 보고한다.
