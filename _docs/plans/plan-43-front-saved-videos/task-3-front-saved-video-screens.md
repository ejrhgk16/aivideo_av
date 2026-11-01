# task-3-front-saved-video-screens

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-43-front-saved-videos/plan.md
- _docs/plans/plan-43-front-saved-videos/task-2-front-saved-video-state.md
- _docs/api/04-playback/saved-videos.md
- front/src/features/playback/savedVideos.ts
- front/src/features/playback/savedVideoState.ts
- front/src/features/playback/SavedVideosProvider.tsx
- front/src/features/playback/episodePlayback.ts
- front/src/features/playback/previewPlayback.ts
- front/src/features/playback/recommendationPreviewBuffer.ts
- front/src/features/user/UserProvider.tsx
- front/src/common/http/errorMessages.ts
- front/src/components/ui.tsx
- front/src/app/episode/[id].tsx
- front/src/app/preview/[dramaId]/[videoId].tsx
- .agents/skills/vercel-react-native-skills/SKILL.md
- front/src/screens/LibraryScreen.tsx
- front/src/screens/playbackScreen_episode.tsx
- front/src/screens/playbackScreen_preview.tsx
- front/src/screens/RecommendationScreen.tsx
- front/src/screens/HomeScreen.tsx
- front/tests/unit/libraryScreen.test.ts
- front/tests/unit/savedVideoScreens.test.ts
- front/tests/unit/playbackScreenEpisode.test.ts
- front/tests/unit/recommendationPreviewBuffer.test.ts
- front/scripts/test-front.cjs

프론트 코드를 작성하기 전에 front/AGENTS.md에 따라 https://docs.expo.dev/versions/v57.0.0/ 의 정확한 버전 문서를 읽는다. 필요한 Router·Video API도 해당 버전 문서에서 확인한다.

## 작업

### 파일 범위

아래 파일만 변경한다. 다른 작업자의 변경을 되돌리지 않는다. 기존 재생·추천 이동·버퍼·시청기록 동작을 읽고 저장 기능에 필요한 부분만 수정한다.

- front/src/screens/LibraryScreen.tsx
- front/src/screens/playbackScreen_episode.tsx
- front/src/screens/playbackScreen_preview.tsx
- front/src/screens/RecommendationScreen.tsx
- front/src/screens/HomeScreen.tsx
- front/tests/unit/libraryScreen.test.ts
- front/tests/unit/savedVideoScreens.test.ts
- front/tests/unit/playbackScreenEpisode.test.ts
- front/tests/unit/recommendationPreviewBuffer.test.ts
- front/scripts/test-front.cjs

### 의존성과 검증

- depends_on: ["task-2"]. 공통 Provider·API·조회 타입·이동 함수가 완료된 뒤 시작한다.
- dev에서 수행하고 branch·worktree를 만들지 않는다. 수정은 apply_patch만 사용한다.

~~~text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
~~~

### 저장 페이지 구현

1. LibraryScreen의 '저장한 작품' 탭을 실제 GET /me/saved-videos 목록에 연결한다. '시청 기록' 탭은 기존 준비 중 안내를 유지하고 저장 목록 API를 호출하지 않는다.
2. 세션 복원이 끝난 후 로그인 사용자만 조회한다. 비로그인은 '로그인이 필요해요'와 로그인 이동을 제공한다. 이전 계정의 목록은 계정 변경 렌더부터 숨긴다. 복원 중·첫 조회 로딩·빈 목록·첫 조회 실패와 재시도·추가 조회 실패를 구별한다. 실패를 빈 목록 성공으로 표시하지 않는다.
3. 화면 포커스 복귀, 계정 변경, 공통 상태의 쓰기 완료 revision 변경 시 첫 페이지를 다시 읽는다. 조회 결과 accept 자체는 revision을 바꾸지 않으므로 effect 의존성에 전체 snapshot/values를 넣지 않는다.
4. page=1, page=2 순서로 30개씩 읽고 hasNext가 true일 때 '더 보기' 버튼을 표시한다. 추가 조회 중에는 중복 클릭을 막는다. 성공 후에만 page를 증가시키며 실패하면 기존 카드·page를 보존해 동일 페이지를 재시도한다. 페이지 사이 데이터 이동으로 중복된 videoUuid는 한 번만 표시한다.
5. 첫 페이지 새 조회와 화면 이탈 때 이전 요청을 세대 번호로 무효화한다. 이전 계정/이전 포커스/이전 페이지 요청이 늦게 도착해 목록·오류·loading을 덮지 않게 한다. 쓰기가 겹친 이전 revision의 조회 결과는 수용하지 않고 현재 revision으로 시작된 새 조회 결과를 사용한다.
6. 카드에 imageUrl 또는 이미지 없음 표시, dramaTitle, 프리뷰/회차 구분, episodeNumber·episodeTitle, durationMs를 표시한다. 저장 목록 한 번의 응답을 사용하며 카드별 작품/재생 API를 미리 호출하지 않는다.
7. 카드를 누르면 task-2의 savedVideoRoute로 이동한다. EPISODE는 episodeUuid와 dramaUuid, PREVIEW는 dramaUuid와 정확한 videoUuid를 전달한다. 가격·구매 여부를 목록에서 추측하지 않고 기존 재생 화면의 권한/구매 안내를 사용한다.
8. Page는 기본적으로 ScrollView이므로 목록 탭은 Page scroll={false}와 기존 React Native FlatList를 사용해 중첩 세로 스크롤을 피한다. 제목·탭·상태·더 보기 배치를 기존 컴포넌트로 구성하며 ui.tsx나 새 라이브러리를 변경하지 않는다.

### 저장 버튼과 초기 상태 연결

1. playbackScreen_episode는 useState(false) 대신 공통 hook을 사용한다. 대상은 playback.videoUuid, 종류는 EPISODE이며 playback.isSaved로 초기 표시한다. 회차 id로 저장 API를 호출하지 않는다.
2. playbackScreen_preview는 경로의 정확한 videoId와 playback.isSaved를 PreviewVideo까지 전달해 공통 PREVIEW hook을 사용한다. 여러 프리뷰 중 첫 항목으로 바꾸어 저장하지 않는다.
3. RecommendationScreen의 drama UUID 기반 savedIds/toggleSave를 제거하고 실제 각 카드의 previewVideos[0].uuid에 연결한다. HomeScreen은 현재 hero.previewVideos[0].uuid를 저장한다. 대상 프리뷰가 없으면 비활성화한다.
4. 화면은 복원 중 또는 요청 중 버튼을 비활성화하고 accessibilityState의 disabled/busy를 맞춘다. 비로그인의 저장 클릭은 로그인 페이지로 안내하며 저장 API를 보내지 않는다. 요청 실패는 기존 getErrorMessage로 화면에 짧게 안내하고 저장 표시를 유지한다. 만료/SessionChangedError는 기존 세션 만료 처리와 충돌하는 중복 안내를 만들지 않는다.
5. 초기 서버 isSaved를 실제 표시와 toggle의 fallback으로 사용한다. 조회 시작 때 revision을 캡처해 결과 적용 시 accept하고, 이미 완료된 로컬 쓰기를 오래된 응답이 덮지 않게 한다. Provider 인스턴스가 바뀐 뒤 이전 계정 응답의 initialSaved를 새 hook에 넘기지 않도록 조회 데이터도 계정/세션에 귀속시킨다.
6. Home/Recommendation/Preview의 기존 mount-only 조회를 세션 복원 대기·포커스 재조회·계정 세대 검사에 맞게 조정한다. 본편의 기존 세션 검사도 보존한다. 로그아웃 시 개인화된 isSaved가 남지 않도록 현재 계정 응답을 얻기 전에는 새 계정에 이전 저장 플래그를 표시하지 않는다.
7. 저장 변경만으로 재생 URL·VideoPlayer·추천 버퍼를 새로 만들지 않는다. 포커스에서 저장 여부를 새로 읽을 필요가 있으면 작품/컬렉션 메타데이터를 갱신하고, 정확한 현재 영상에 대응하는 flags만 accept한다. 본편은 필요 시 새 재생 응답의 저장 메타데이터만 수용하고 기존 재생 중 URL을 교체하지 않는다.
8. 추천 버퍼의 유지·해제·리소스 정리, 첫 프레임, 스와이프/휠, 재생 위치·자동 다음 회차·시청기록을 유지한다. 계정 변경 시 진행 중인 개인화 요청 결과는 무시하되 저장 상태 갱신을 이유로 입력·버퍼 구조를 리팩토링하지 않는다.
9. 홈 재생 버튼은 기존 상태를 유지한다. 보관함 카드에 별도의 삭제 버튼 등 승인되지 않은 UI 기능을 추가하지 않는다. 저장 해제는 각 재생/추천/홈의 공통 버튼에서 처리한다.

### 주요 로직 코드 또는 변경 예시

공통 버튼 사용 예시다. useSavedVideo는 task-2의 hook이며 saved/pending/toggle을 제공한다. 조회 값은 현재 Provider와 같은 세션에서 가져온 것만 전달한다. 동일한 흐름을 네 화면에서 사용하고 API 호출·공유 상태 로직을 화면에 복제하지 않는다.

~~~tsx
const target = playback.videoUuid;
const { saved, pending, toggle } = useSavedVideo(target, 'EPISODE', playback.isSaved);
const { user, isRestoring, sessionVersion, isCurrentSession } = useUser();
const [saveError, setSaveError] = useState<string | null>(null);

async function onToggleSave() {
  if (isRestoring || pending || !target) return;
  if (!user) {
    router.push('/login');
    return;
  }
  const version = sessionVersion;
  setSaveError(null);
  try {
    await toggle();
  } catch (error) {
    if (!isCurrentSession(version) || error instanceof SessionChangedError) return;
    if (error instanceof ApiError && error.errorCode === 'AUTH_INVALID_TOKEN') return;
    setSaveError(getErrorMessage(error));
  }
}

<Pressable
  disabled={isRestoring || pending || !target}
  onPress={onToggleSave}
  accessibilityRole="button"
  accessibilityLabel={saved ? '저장 해제' : '영상 저장'}
  accessibilityState={{ disabled: isRestoring || pending || !target, busy: pending }}
>
  <Icon name="bookmark" color={saved ? colors.accent : '#fff'} />
  <AppText>{pending ? '처리 중' : saved ? '저장됨' : '저장'}</AppText>
</Pressable>
{saveError ? <AppText accessibilityRole="alert">{saveError}</AppText> : null}
~~~

프리뷰 화면의 전달은 다음처럼 정확한 영상 대상을 유지한다. 서버 응답의 videoUuid도 요청 videoId와 일치하는 계약이다.

~~~tsx
return <PreviewVideo
  drama={state.drama}
  videoId={videoId}
  initialSaved={state.playback.isSaved}
  url={state.playback.url}
  onClose={back}
/>;

const preview = hero?.previewVideos[0] ?? null;
const heroSave = useSavedVideo(preview?.uuid ?? null, 'PREVIEW', preview?.isSaved ?? false);
~~~

보관함 요청의 핵심 흐름이다. requestId/inFlight/ownerRef는 useRef, list는 화면 상태이며 ownerRef.current는 매 렌더 현재 savedVideos로 설정한다. 첫 페이지 교체와 세션/포커스 cleanup은 requestId를 증가시켜 이전 요청을 취소 취급한다. actual network 취소를 위한 공통 HTTP client 변경은 하지 않는다.

~~~ts
async function loadPage(page: number, replace: boolean) {
  if (!user || isRestoring || (inFlight.current && !replace)) return;
  const request = ++requestId.current;
  const version = sessionVersion;
  const startedRevision = savedVideos.getSnapshot().revision;
  const current = () => requestId.current === request &&
    ownerRef.current === savedVideos && isCurrentSession(version);
  inFlight.current = true;
  setList(previous => replace
    ? { owner: savedVideos, items: [], page: 0, hasNext: false, loading: true, error: null }
    : { ...previous, loading: true, error: null });
  try {
    const result = await getSavedVideos(page);
    if (!current()) return;
    if (!savedVideos.accept(result.items.map(item => ({
      videoUuid: item.videoUuid, isSaved: true,
    })), startedRevision)) return;
    setList(previous => {
      const items = replace ? result.items : [...previous.items, ...result.items];
      return {
        owner: savedVideos,
        items: [...new Map(items.map(item => [item.videoUuid, item])).values()],
        page: result.page, hasNext: result.hasNext, loading: false, error: null,
      };
    });
  } catch (error) {
    if (!current() || error instanceof SessionChangedError) return;
    setList(previous => ({ ...previous, error: getErrorMessage(error) }));
  } finally {
    if (current()) {
      inFlight.current = false;
      setList(previous => ({ ...previous, loading: false }));
    }
  }
}
~~~

포커스 effect의 의존성은 tab, 사용자 UUID, isRestoring, sessionVersion, savedVideos 인스턴스와 snapshot.revision 등 실제 재조회 조건만 둔다. 포커스+저장 탭+로그인일 때 loadPage(1, true)를 호출하고 cleanup에서 requestId를 증가시키고 inFlight를 해제한다. 추가 조회는 성공한 list.page + 1로 호출한다. 계정이 바뀐 렌더에서 list.owner !== savedVideos이면 이전 카드를 표시하지 않는다.

목록에서 이동은 공통 함수를 사용한다.

~~~tsx
<Pressable
  onPress={() => router.push(savedVideoRoute(item))}
  accessibilityRole="button"
  accessibilityLabel={item.dramaTitle + (item.contentType === 'PREVIEW'
    ? ' 미리보기 재생' : ' ' + item.episodeNumber + '화 재생')}
>
  <AppText>{item.dramaTitle}</AppText>
  <AppText>{item.contentType === 'PREVIEW' ? '미리보기' : item.episodeNumber + '화'}</AppText>
</Pressable>
~~~

### 테스트와 완료 조건

- libraryScreen.test.ts는 기존 화면 테스트처럼 실제 TSX를 렌더해 API·Router를 제어한다. 비로그인/복원 중 호출 없음, 빈 목록/첫 조회 오류·재시도, 두 종류 카드의 정확한 경로, hasNext·추가 페이지/중복 클릭/실패 재시도, 탭 전환·포커스 복귀, 계정 전환 후 이전 응답 무시를 검증한다. 테스트에 API 서버를 대신 띄우지 않는다.
- savedVideoScreens.test.ts는 Home/Preview의 실제 화면에서 서버 초기 저장 표시, 정확한 프리뷰 UUID(두 번째 프리뷰 직접 재생 포함), 저장/해제, 실패 유지·안내, 복원 중·대상 없음·진행 중 비활성화, 비로그인 로그인 안내를 검증한다. 공통 store의 테스트로 화면 버튼 연결 검증을 대체하지 않는다.
- playbackScreenEpisode.test.ts는 실제 본편 영상 UUID로 공통 hook을 연결하는지, 초기 저장 상태·호출/해제·세션 전환을 검사하고 기존 시청기록·재생 회귀 검증을 유지한다.
- recommendationPreviewBuffer.test.ts의 화면 harness를 UserProvider/저장 hook 호출에 맞춰 갱신하고 drama UUID 대신 현재 첫 프리뷰 UUID를 저장하는지 검사한다. 기존 순차 이동·버퍼·플레이어 생성 횟수·release assertion을 유지하며 저장 클릭으로 플레이어 생성/재생 위치가 바뀌지 않음을 검사한다.
- front/scripts/test-front.cjs의 testFiles에 이 task에서 생성한 libraryScreen.test.ts, savedVideoScreens.test.ts를 추가한다. 기존 테스트 목록을 삭제하지 않는다.
- checks 3개 통과, 저장 후 보관함/다른 화면 반영, 저장 해제 후 복귀 목록에서 제외, 두 종류 재생 이동, 계정 간 상태 격리와 오류 복구가 확인되면 완료다.
- 서버가 필요한 실제 UI/API 확인은 기존 http://localhost:8081 및 http://localhost:3000을 사용한다. 서버가 없으면 실패로 보고 각각 npm --prefix front run start -- --port 8081, npm --prefix back run start:dev를 안내한다. 서버를 자동 시작하거나 다른 포트를 사용하지 않는다.
