# task-1-screen-saved-actions

## 읽어야 할 파일

- `AGENTS.md`, `front/AGENTS.md`, `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-47-screen-local-saved-videos/plan.md`, `index.json`
- `_docs/api/00-overview/error-code.md`
- `front/src/features/playback/SavedVideosProvider.tsx`, `savedVideoState.ts`, `savedVideos.ts`, `playbackResponses.ts`
- `front/src/features/user/UserProvider.tsx`, `sessionClient.ts`
- `front/src/screens/RecommendationScreen.tsx`, `playbackScreen_preview.tsx`, `playbackScreen_episode.tsx`
- `front/src/features/playback/recommendationPreviewBuffer.ts`, `watchProgress.ts`
- 아래 수정 허용 테스트와 읽기/실행 전용 `front/tests/unit/savedVideoState.test.ts`, `savedVideos.test.ts`, `watchProgress.test.ts`
- 구현 전에 `front/AGENTS.md`가 요구하는 Expo SDK 57 문서: https://docs.expo.dev/versions/v57.0.0/ . 계획 작성 대화에서 이미 읽었더라도 worker는 적용 API를 확인한다.

## 작업

세 재생 화면이 `SavedVideosProvider`와 `savedVideoState`를 사용하지 않고 저장·해제 및 포커스 재조회 동작을 수행하도록 한다. 코드의 소유 범위는 다음 6개 파일뿐이다.

```text
front/src/screens/RecommendationScreen.tsx
front/src/screens/playbackScreen_preview.tsx
front/src/screens/playbackScreen_episode.tsx
front/tests/unit/savedVideoScreens.test.ts
front/tests/unit/recommendationPreviewBuffer.test.ts
front/tests/unit/playbackScreenEpisode.test.ts
```

### 구현 조건

1. 기존 `saveVideo(videoUuid, contentType)`·`removeSavedVideo(videoUuid)`를 각 화면에서 직접 호출한다. 새 훅·공통 상태 함수·전역 Map·구독 store를 만들지 않는다. 기존 화면 내부의 player 컴포넌트와 props를 사용할 수 있다.
2. 초기 저장 여부는 기존 API 응답에서 가져온다. 프리뷰는 경로의 정확한 `videoId`, 추천은 현재 카드의 첫 preview UUID, 에피소드는 `playback.videoUuid`를 사용한다. drama UUID나 episode UUID를 저장 키로 사용하지 않는다. 프리뷰가 없으면 저장 요청을 보내지 않는다.
3. 화면 안의 `useState`로 저장 표시·pending·오류를 다룬다. 저장 성공 후에만 해당 영상의 `isSaved`를 반전한다. 실패 시 기존 표시를 유지하고 pending을 풀어 재시도할 수 있게 한다. 같은 렌더 사이의 연속 클릭도 `useRef` 등의 즉시 잠금으로 한 요청만 보내도록 한다.
4. 비로그인 저장은 `/login`으로 이동하고 쓰기를 하지 않는다. 복원 중에는 버튼을 비활성화한다. 기존 `getErrorMessage`, `SessionChangedError`, 세션 만료 모달 규칙은 유지하며 공통 오류 정책을 바꾸지 않는다.
5. UUID·세션 버전·마운트/요청 수명 검사로 이전 사용자나 영상의 완료 결과·오류가 현재 버튼을 덮지 않게 한다. 세션/영상 교체에 따른 로컬 상태 초기화는 플레이어의 실제 콘텐츠/세션 교체 시에만 한다. 저장·메타데이터 변경을 컴포넌트 key나 미디어 URL에 포함하지 않는다.
6. 포커스의 기존 메타데이터 조회를 이용해 서버의 저장 여부를 반영한다. 조회 시작 이후 저장 요청이 시작/완료됐다면 오래된 저장 플래그를 반영하지 않는다. pending 중의 조회도 완료된 쓰기 결과를 되돌릴 수 없다. 필요한 검사는 화면 내부의 숫자 ref·pending ref 정도로 한정하며 기존 전역 revision store를 복제하지 않는다.
7. 미리보기는 최초 playback 조회의 `isSaved`로 시작한다. 복귀 시 기존 `getDramaContent`에서 경로에 일치하는 preview를 찾아 표시를 갱신한다. 재조회가 `state.drama`만 바꾸고 화면이 계속 오래된 `state.playback.isSaved`를 읽는 일이 없도록 표시 데이터 경로까지 연결한다. 서명 URL 재요청 없이 기존 플레이어·위치를 유지한다.
8. 에피소드는 기존 drama 포커스 조회에서 `episode.uuid === id` 및 `episode.videoUuid === playback.videoUuid`에 일치하는 항목만 반영한다. `dramaId`가 없는 직접 진입도 기존 재생/저장 기능이 동작해야 한다. 불필요한 playback 재조회나 새 API를 만들지 않는다.
9. 추천은 저장 성공 결과를 현재 `collection.dramas[].previewVideos[].isSaved`에도 반영한다. 활성 player 컨트롤은 카드 전환 시 해제되므로 컨트롤의 boolean 하나만 바꾸면 앞 카드 복귀 때 저장 표시가 되돌아간다. 기존 collection 데이터에서 정확한 영상 행만 갱신하고 별도 UUID별 사전을 만들지 않는다. 이전 카드 쓰기가 늦게 끝나도 다른 카드에 적용하지 않는다. 컬렉션 재조회가 완료된 쓰기를 덮지 않게 하고 refocus 시 새 서버 상태를 반영한다. 기존 정렬·offset·buffer·player 수명은 유지한다.
10. 이 task에서는 홈·보관함·루트의 Provider와 두 저장 소스를 삭제하지 않는다. 남은 소비처는 task-2가 전환한다. `savedVideoScreens.test.ts`의 홈 저장 테스트는 task-2 전까지 기존 동작을 유지한다.

### 주요 로직 코드 또는 변경 예시

아래는 `playbackScreen_episode.tsx`의 기존 `PlaybackVideo` 안에서 수행할 로컬 저장 및 메타데이터 흐름의 예시다. 실제 컴포넌트에는 기존 focus effect와 오류 UI를 재사용하고, 같은 effect를 중복 추가하지 않는다. 이 코드를 새 공통 훅이나 store로 추출하지 않는다.

```tsx
const [isSaved, setIsSaved] = useState(playback.isSaved);
const [saving, setSaving] = useState(false);
const [savedError, setSavedError] = useState<unknown>(null);
const savePending = useRef(false);
const savedWriteRevision = useRef(0);
const mounted = useRef(false);

useEffect(() => {
  mounted.current = true;
  return () => { mounted.current = false; };
}, []);

const toggleSaved = async () => {
  if (isRestoring || savePending.current) return;
  if (!user) { router.push('/login'); return; }
  const version = sessionVersion;
  const nextSaved = !isSaved;
  savePending.current = true;
  savedWriteRevision.current += 1;
  setSaving(true);
  setSavedError(null);
  try {
    if (nextSaved) await saveVideo(playback.videoUuid, 'EPISODE');
    else await removeSavedVideo(playback.videoUuid);
    if (mounted.current && isCurrentSession(version)) setIsSaved(nextSaved);
  } catch (error) {
    if (!mounted.current || !isCurrentSession(version)) return;
    if (error instanceof SessionChangedError ||
      (error instanceof ApiError && error.status === 401 && sessionExpired)) return;
    setSavedError(error);
  } finally {
    savedWriteRevision.current += 1;
    savePending.current = false;
    if (mounted.current && isCurrentSession(version)) setSaving(false);
  }
};

useFocusEffect(useCallback(() => {
  let active = true;
  const version = sessionVersion;
  const startedRevision = savedWriteRevision.current;
  if (dramaId && !isRestoring) {
    void getDramaContent(dramaId).then((result) => {
      if (!active || !isCurrentSession(version)) return;
      setDrama(result);
      const episode = result.episodes.find((item) =>
        item.uuid === id && item.videoUuid === playback.videoUuid);
      if (episode && !savePending.current &&
        savedWriteRevision.current === startedRevision) {
        setIsSaved(episode.isSaved);
      }
    }).catch(() => undefined);
  }
  return () => {
    active = false;
    focused.current = false;
    previousPlaybackTime.current = null;
    player.pause();
  };
}, [player, dramaId, id, playback.videoUuid, isRestoring,
  sessionVersion, isCurrentSession]));
```

부모 화면에서 `PlaybackVideo`의 수명을 현재 사용자 UUID·세션 버전·영상 UUID에 맞춘다. 다른 영상/계정으로 전환할 때만 로컬 저장 상태를 초기화하고, 저장 플래그나 메타데이터 재조회로 key를 바꾸지 않는다. 기존 key·언마운트 경로로 같은 보장이 성립한다면 불필요한 key나 초기화를 추가하지 않는다. key가 필요한 경우 기존 PlaybackVideo 호출 지점에서 다음 값을 사용할 수 있다.

```tsx
key={`${user?.uuid ?? 'anonymous'}:${sessionVersion}:${playback.videoUuid}`}
```

추천에서 API 성공 시 기존 collection을 갱신하는 호출 지점의 예시다. 아래 콜백은 화면 내부에 두며, 전달받은 쓰기 시작 시점의 세션을 검사한다. 읽기 시작 시점의 revision 검사도 추천 화면의 collection 재조회에 직접 연결한다. activeDrama나 오래된 preview props가 이 값을 다시 덮어쓰지 않도록 표시의 기준을 한 곳으로 정한다.

```tsx
onSavedChange={(videoUuid: string, nextSaved: boolean, version: number) => {
  if (!isCurrentSession(version)) return;
  setCollection((current) => current === null ? current : {
    ...current,
    dramas: current.dramas.map((item) => item.uuid !== drama.uuid ? item : {
      ...item,
      previewVideos: item.previewVideos.map((preview) =>
        preview.uuid === videoUuid ? { ...preview, isSaved: nextSaved } : preview),
    }),
  });
}}
```

### 테스트와 완료 조건

- Provider 훅 반환값을 mock해서 'toggle 호출됨'만 검사하던 재생 테스트를 `saveVideo`·`removeSavedVideo`의 실제 인자와 화면 표시·disabled/busy 상태를 검사하도록 바꾼다. 기존 수동 React/플레이어 harness는 필요한 생명주기·재렌더 지원만 보완한다.
- 세 화면의 저장·해제 성공, 실패 후 기존 표시/재시도, 렌더 전 중복 클릭, 익명 이동, 영상/계정 교체 뒤 늦은 응답, pending/완료된 쓰기보다 오래된 읽기 응답을 검사한다. 기존 store 테스트를 지우기 전에 필요한 사용자 동작 경계를 이 화면 테스트로 옮긴다.
- 추천은 카드 A 저장 후 B로 이동했다가 A로 복귀하는 경우와 포커스 복귀의 서버 저장 여부 갱신을 검사한다. 기존 버퍼·제스처·컨트롤 회귀 테스트도 통과해야 한다.
- 미리보기는 정확한 route UUID를 사용하고, refocus의 metadata 응답으로 버튼이 갱신돼도 서명 playback 조회 횟수·player 인스턴스·재생 위치가 유지되는지 검사한다. 에피소드도 저장 변경으로 player·시청기록 처리가 초기화되지 않아야 한다.
- 세 재생 소스에서 `SavedVideosProvider`, `useSavedVideos`, 기존 `useSavedVideo` 참조가 없어야 한다. 홈 관련 mock만 다음 task를 위해 남길 수 있다.
- 검증 명령:

```text
npm --prefix front run test -- tests/unit/savedVideoScreens.test.ts tests/unit/recommendationPreviewBuffer.test.ts tests/unit/playbackScreenEpisode.test.ts tests/unit/savedVideos.test.ts tests/unit/watchProgress.test.ts
```

검증은 API와 미디어를 모의 처리하며 서버·실제 DB·외부 영상에 의존하지 않는다. `savedVideos.test.ts`와 `watchProgress.test.ts`는 읽기/실행 전용이다. 테스트 실행기, 공통 API/오류 처리, UserProvider, 추천 버퍼 모듈은 수정하지 않는다. 다른 변경을 되돌리지 않고 기존 스타일을 따른다. task-2와 병렬 실행하지 않는다.

