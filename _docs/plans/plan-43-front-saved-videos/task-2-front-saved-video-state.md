# task-2-front-saved-video-state

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-43-front-saved-videos/plan.md
- _docs/plans/plan-43-front-saved-videos/task-1-backend-saved-video-responses.md
- _docs/api/04-playback/saved-videos.md
- _docs/api/04-playback/episodes.md
- _docs/api/02-content/dramas.md
- _docs/api/03-programming/collections.md
- front/src/features/user/UserProvider.tsx
- front/src/features/user/sessionClient.ts
- front/src/common/http/api.ts
- .agents/skills/api-and-interface-design/SKILL.md
- .agents/skills/vercel-react-native-skills/SKILL.md

프론트 코드를 작성하기 전에 front/AGENTS.md에 따라 https://docs.expo.dev/versions/v57.0.0/ 의 정확한 버전 문서를 읽는다. 필요한 Router API도 해당 버전 문서에서 확인한다.

## 작업

### 파일 범위

아래 파일만 변경한다. 다른 작업자의 변경을 되돌리지 않고 최신 코드를 읽어 반영한다.

- front/src/features/playback/savedVideos.ts
- front/src/features/playback/savedVideoState.ts
- front/src/features/playback/SavedVideosProvider.tsx
- front/src/features/playback/episodePlayback.ts
- front/src/features/playback/previewPlayback.ts
- front/src/features/drama/dramaContent.ts
- front/src/features/home/homeContent.ts
- front/src/app/_layout.tsx
- front/tests/unit/savedVideos.test.ts
- front/tests/unit/savedVideoState.test.ts
- front/tests/unit/episodePlayback.test.ts
- front/tests/unit/previewPlayback.test.ts
- front/tests/unit/dramaContent.test.ts
- front/tests/unit/homeContent.test.ts
- front/scripts/test-front.cjs
- _docs/ARCHITECTURE.md

### 의존성과 검증

- depends_on: ["task-1"]. 완료된 백엔드 응답 계약과 구현을 먼저 확인한다.
- dev에서 수행하고 branch·worktree를 만들지 않는다. 수정은 apply_patch만 사용한다.

~~~text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
~~~

### 목표와 구현 지시

1. savedVideos.ts는 task-1과 동일한 SavedContentType, SavedVideoItem, SavedVideoPage 타입, 저장·해제·목록 API 함수와 savedVideoRoute 함수를 소유한다. 기존 sessionClient.apiRequest를 사용해 Refresh·오류·계정 변경 처리를 재사용한다.
2. 저장은 PUT + { contentType }, 해제는 body 없는 DELETE, 목록은 page만 붙인 GET이며 모두 auth: 'required'다. body 없는 204에서 JSON 파싱을 시도하지 않는다. 새 endpoint나 저장 여부만 얻기 위한 전체 페이지 순회를 만들지 않는다.
3. savedVideoState.ts는 React에 의존하지 않는 작은 상태 모듈이다. 영상 UUID별 isSaved/pending, 서버 조회와 쓰기 응답 순서를 구분할 revision, 구독과 toggle을 제공한다. 동기적으로 pending을 선점해 같은 영상의 빠른 연속 클릭을 하나의 요청으로 제한한다.
4. API 성공 후에만 isSaved를 변경한다. 실패하면 기존 상태로 pending만 해제하고 호출자에게 오류를 전달한다. 자동 재시도 정책은 추가하지 않는다. 다른 영상의 요청은 서로 막지 않는다.
5. 이미 성공한 쓰기를 이전 조회 응답이 덮어쓰지 않도록 조회 시작 때 revision을 캡처하고 적용 시 검사한다. 각 쓰기가 성공/실패로 끝날 때 revision을 증가시킨다. 조회 데이터 수용만으로 revision을 증가시키지 않는다. pending 영상의 값은 조회 응답으로 덮지 않는다.
6. SavedVideosProvider.tsx는 UserProvider 안에서 계정 UUID와 sessionVersion별 독립 상태 인스턴스를 제공한다. 계정이 바뀐 렌더부터 빈 상태를 사용해 이전 계정의 값이 한 프레임도 표시되지 않게 한다. 이전 인스턴스의 응답이 새 인스턴스를 변경할 수 없어야 한다.
7. useSavedVideos는 목록/조회용 상태·revision·accept를, useSavedVideo는 특정 영상의 saved/pending/toggle을 제공한다. 실제 구현은 하나의 Provider와 작은 hook으로 끝낸다. 중복 전역 캐시·영구 저장·새 라이브러리는 만들지 않는다. 비로그인/복원 중 호출 차단과 사용자 안내는 task-3의 화면이 담당한다.
8. 작품 목록·컬렉션·프리뷰 재생 API는 auth: 'public'에서 'optional'로 변경한다. 작품 상세·본편 재생의 optional은 유지한다. API가 반환한 videoUuid/isSaved를 손실 없이 전달하고 기존 URL 정규화도 유지한다.
9. DramaSummary/HomeCollectionDrama/DramaContent의 프리뷰에 필수 isSaved를 추가한다. DramaContent.episodes에는 videoUuid: string | null, isSaved: boolean을 추가한다. EpisodePlayback와 PreviewPlayback에는 videoUuid: string, isSaved: boolean을 추가한다. task-1의 실제 계약과 일치시킨다.
10. root layout은 UserProvider → SavedVideosProvider → 기존 자식 순서로 감싼다. 내비게이션을 key로 재마운트하지 않는다. 기존 폰트 로딩·만료 팝업·SecureStore·Refresh 처리를 변경하지 않는다.
11. _docs/ARCHITECTURE.md에 playback feature의 공통 저장 API·상태 책임과 Provider 수명, 선택 인증으로 바뀐 요청을 기록한다. UserProvider의 사용자·포인트 책임은 유지한다.

### 주요 로직 코드 또는 변경 예시

API 호출과 저장 종류에 따른 이동은 다음 흐름을 따른다. SavedVideoItem은 task-1의 discriminated union 계약을 그대로 정의한다.

~~~ts
export function saveVideo(videoUuid: string, contentType: SavedContentType): Promise<void> {
  return apiRequest<void>('/me/saved-videos/' + encodeURIComponent(videoUuid), {
    auth: 'required', method: 'PUT', json: { contentType },
  });
}
export function removeSavedVideo(videoUuid: string): Promise<void> {
  return apiRequest<void>('/me/saved-videos/' + encodeURIComponent(videoUuid), {
    auth: 'required', method: 'DELETE',
  });
}
export function getSavedVideos(page = 1): Promise<SavedVideoPage> {
  return apiRequest<SavedVideoPage>('/me/saved-videos?page=' + encodeURIComponent(page), {
    auth: 'required',
  });
}
export function savedVideoRoute(item: SavedVideoItem) {
  return item.contentType === 'EPISODE'
    ? { pathname: '/episode/[id]' as const,
        params: { id: item.episodeUuid, dramaId: item.dramaUuid } }
    : { pathname: '/preview/[dramaId]/[videoId]' as const,
        params: { dramaId: item.dramaUuid, videoId: item.videoUuid } };
}
~~~

공통 상태의 핵심 구현 예시다. send는 Provider에서 saveVideo/removeSavedVideo로 연결하고 isCurrent는 현재 세션 유효성을 확인한다. snapshot은 변경 시에만 새 객체를 만들고 getSnapshot은 같은 참조를 유지해 useSyncExternalStore에서 재렌더 루프를 만들지 않는다.

~~~ts
type Entry = { isSaved: boolean; pending: boolean };
type Snapshot = { videos: Record<string, Entry>; revision: number };
type Observation = { videoUuid: string; isSaved: boolean };

export function createSavedVideoState(
  send: (videoUuid: string, contentType: SavedContentType, next: boolean) => Promise<void>,
  isCurrent: () => boolean,
) {
  let snapshot: Snapshot = { videos: {}, revision: 0 };
  const listeners = new Set<() => void>();
  function publish(videos: Snapshot['videos'], revision = snapshot.revision) {
    snapshot = { videos, revision };
    for (const listener of listeners) listener();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    accept(rows: Observation[], startedRevision: number) {
      if (!isCurrent() || snapshot.revision !== startedRevision) return false;
      const videos = { ...snapshot.videos };
      for (const row of rows) {
        if (!videos[row.videoUuid]?.pending) {
          videos[row.videoUuid] = { isSaved: row.isSaved, pending: false };
        }
      }
      publish(videos);
      return true;
    },
    async toggle(videoUuid: string, contentType: SavedContentType, initialSaved: boolean) {
      if (!isCurrent()) return false;
      const entry = snapshot.videos[videoUuid] ?? { isSaved: initialSaved, pending: false };
      if (entry.pending) return false;
      let saved = entry.isSaved;
      publish({ ...snapshot.videos, [videoUuid]: { ...entry, pending: true } });
      try {
        await send(videoUuid, contentType, !entry.isSaved);
        if (!isCurrent()) return false;
        saved = !entry.isSaved;
        return true;
      } finally {
        if (isCurrent()) {
          publish({ ...snapshot.videos, [videoUuid]: { isSaved: saved, pending: false } },
            snapshot.revision + 1);
        }
      }
    },
  };
}
~~~

Provider의 핵심 연결은 다음과 같다. 실제 파일에는 Context와 useSavedVideos/useSavedVideo도 구현한다. isCurrentSession은 UserProvider의 기존 함수를 재사용하며 계정 UUID를 useMemo 의존성에 포함해 같은 version에서 사용자 값이 바뀌어도 인스턴스를 공유하지 않는다.

~~~tsx
const { user, sessionVersion, isCurrentSession } = useUser();
const savedVideos = useMemo(() => createSavedVideoState(
  (uuid, type, next) => next ? saveVideo(uuid, type) : removeSavedVideo(uuid),
  () => isCurrentSession(sessionVersion),
), [user?.uuid, sessionVersion, isCurrentSession]);
const snapshot = useSyncExternalStore(
  savedVideos.subscribe, savedVideos.getSnapshot, savedVideos.getSnapshot,
);
const value = useMemo(() => ({ savedVideos, snapshot }), [savedVideos, snapshot]);
return <SavedVideosContext.Provider value={value}>{children}</SavedVideosContext.Provider>;
~~~

특정 영상 hook은 snapshot.videos[videoUuid]가 없을 때 API의 initialSaved를 읽고, 있을 때 공유 값을 우선한다. 대상 UUID가 null이면 saved: false, pending: false로 표시하고 호출을 막는다. hook의 toggle은 위 상태 인스턴스에 실제 영상 UUID·종류·initialSaved를 전달한다. 서버 조회가 끝날 때는 조회 시작 시 캡처한 revision으로 accept를 호출한다. render 중 accept를 호출하거나 useEffect가 자기 상태 변경으로 반복 실행되지 않게 한다.

### 테스트와 완료 조건

- savedVideos.test.ts: 두 종류의 PUT body·UUID 인코딩, body 없는 DELETE와 204, page 전달, 필수 인증, 두 재생 경로의 정확한 파라미터를 검사한다. API의 인증·갱신 로직 자체를 복제하지 않는다.
- savedVideoState.test.ts: 저장/해제 성공, 실패 후 원상태·재시도, 연속 클릭 단일 호출, 다른 영상 동시 요청, 서버 초기값, stale 조회 거부, pending 항목 보호, 안정된 snapshot 참조와 구독 정리, 세션 종료 뒤 응답 무시·새 인스턴스 독립을 검사한다.
- 기존 homeContent/dramaContent/previewPlayback/episodePlayback 테스트를 확장 계약과 선택 인증으로 수정한다. 로그인 요청에는 Access가 붙고 익명은 Authorization을 보내지 않는지 검사한다. 기존 URL 정규화·오류 처리 assertion은 유지한다.
- front/scripts/test-front.cjs의 명시적 testFiles에 이 task에서 생성한 savedVideos.test.ts와 savedVideoState.test.ts만 추가한다. task-3의 아직 없는 테스트 파일을 미리 등록하지 않는다.
- 저장 Provider를 연결한 상태로 checks 3개가 모두 통과하고, 로그인·로그아웃·다른 계정에서 저장 상태가 분리되며, API 계약·아키텍처 문서가 일치하면 완료다.
- 서버가 필요한 수동 확인에서는 기존 8081/3000 서버를 사용한다. 없으면 실패로 보고 npm --prefix front run start -- --port 8081 또는 npm --prefix back run start:dev를 안내한다. 에이전트가 서버를 자동 실행하지 않는다.
