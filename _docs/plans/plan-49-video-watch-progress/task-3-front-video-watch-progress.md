# task-3-front-video-watch-progress

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-49-video-watch-progress/plan.md`
- `_docs/api/04-playback/watch-progress.md`
- `front/src/features/playback/watchProgress.ts`
- `front/src/features/playback/episodePlayback.ts`
- `front/src/features/playback/playbackResponses.ts`
- `front/src/screens/playbackScreen_episode.tsx`
- `front/tests/unit/watchProgress.test.ts`
- `front/tests/unit/playbackScreenEpisode.test.ts`
- `front/tests/unit/session.test.ts`
- `front/tests/unit/dramaDetailScreen.test.ts`

## 작업

본편의 기록 요청이 episode UUID 대신 실제 재생 응답의 videoUuid를 사용하도록 전환한다. 기존 재생 이벤트 기준과 session 보호를 유지한다.

### 수정 허용 파일

- `front/src/features/playback/watchProgress.ts`
- `front/src/screens/playbackScreen_episode.tsx`
- `front/tests/unit/watchProgress.test.ts`
- `front/tests/unit/playbackScreenEpisode.test.ts`
- `front/tests/unit/session.test.ts`

### 의존성과 검증 명령

- `depends_on`: `["task-2"]`

```text
npm --prefix front run test -- tests/unit/watchProgress.test.ts tests/unit/playbackScreenEpisode.test.ts tests/unit/dramaDetailScreen.test.ts tests/unit/session.test.ts
```


### 실행 전제와 구현 지시

- task-2 완료 후 검증된 API 계약을 사용한다. plan-48와 다른 plan의 변경을 보존한다.
- front/AGENTS.md에 따라 코드 작성 전 https://docs.expo.dev/versions/v57.0.0/ 의 정확한 버전 문서를 읽는다. 기존 expo-video 이벤트를 유지하며 새 라이브러리나 설정을 추가하지 않는다.
- saveWatchProgress의 인자 이름을 videoUuid로 바꾸고 /me/videos/:videoUuid/watch-progress를 required auth PUT으로 호출한다. encodeURIComponent, 기존 body·void/204 처리 유지.
- 본편 화면의 tracker callback에서 id가 아닌 playback.videoUuid를 캡처한다. effect dependency에도 videoUuid를 포함하고 영상 교체·세션 변경·화면 종료에서 이전 tracker와 타이머/구독을 정리한다.
- 기존 실제 재생 중 시간 증가 샘플, focused/ready/playing 검사, seek·버퍼링·일시정지 제외, STARTED 1회·2/3 이후 COMPLETED 1회·네트워크/5xx만 1회 재시도를 유지한다.
- 재생/드라마 이동 route의 회차 ID는 바꾸지 않는다. 기록 저장 요청만 영상 UUID를 쓴다. 프리뷰 화면·추천 피드 자동 기록, 보관함·목록·페이징은 구현하지 않는다.
- watchProgress.test.ts는 URL 인코딩·required auth·method·body를 영상 UUID 기준으로 검증하고 기존 tracker/retry 검사를 유지한다.
- playbackScreenEpisode.test.ts의 mock은 요청한 UUID도 수집한다. 실제 playback.videoUuid와 episode id가 다른 fixture로 올바른 전송 대상을 확인하고, 시작/완료 모두 같은 실제 영상 ID를 보내는지 검증한다.
- 영상 변경 후 오래된 tracker/재시도가 새 영상·계정으로 기록하지 않는지, 익명/복원 중에는 보내지 않는지 확인한다. 기존 완료 경계/seek/일시정지 보호를 보존한다.
- session.test.ts에 있는 이전 회차 기록 요청 경로를 새 영상 경로로 바꾸고 기존 인증 만료·공유 refresh·원요청 재시도 검증을 유지한다. 실제 sessionClient 구현은 변경하지 않는다.
- dramaDetailScreen.test.ts는 읽기/실행만 한다. 대표 영상의 watchProgress로 완료 회차 표시가 계속 동작하는지 회귀 검증한다.

### 주요 로직 코드 또는 변경 예시

API 함수의 실제 호출 경로를 전환한다.

```ts
export function saveWatchProgress(videoUuid: string, input: WatchProgressInput): Promise<void> {
  return apiRequest<void>(`/me/videos/${encodeURIComponent(videoUuid)}/watch-progress`, {
    auth: 'required',
    method: 'PUT',
    json: input,
  });
}
```

본편 PlaybackVideo의 기존 tracker effect에서 실제 영상 UUID를 캡처한다. 기존 timeUpdate/playingChange/statusChange listener 및 cleanup 흐름은 유지한다.

```ts
const version = sessionVersion;
const videoUuid = playback.videoUuid;
const tracker = createWatchProgressTracker(
  (input) => saveWatchProgress(videoUuid, input),
  () => isCurrentSession(version),
);
```

effect의 의존성은 기존 값을 보존하면서 영상 ID를 포함한다.

```ts
[id, playback.videoUuid, isCurrentSession, isRestoring,
 playback.durationMs, player, sessionVersion, user?.uuid]
```

listener의 재생 샘플 검사 후 호출하는 tracker.onProgress(positionMs, playback.durationMs)와 effect cleanup의 listener.remove()/tracker.dispose()를 유지한다. 플레이어/영상 교체 시 이전 effect를 정리하고 새 UUID로 새 tracker를 만든다. 기존 컴포넌트 key의 sessionVersion/videoUuid 구분도 유지한다.

### 검증과 완료 조건

- 선언한 네 테스트 파일을 선택 실행해 통과한다. API 함수·실제 화면 전송 대상·세션 재시도·상세 완료 표시를 함께 확인한다.
- 프론트 제품 source에 이전 /me/episodes/.../watch-progress 요청이 남지 않는다. 회차 재생·구매·이동의 기존 episode 식별자는 정상이다.
- API 응답 타입·화면 디자인·다른 feature를 변경하지 않는다. 의미 없는 포맷 수정이나 별도 추상화는 추가하지 않는다.
- 서버 기반 추가 검증을 한다면 기존 8081/3000만 사용한다. 없는 서버를 자동 실행하지 않고 실패와 실행 명령을 안내한다.
