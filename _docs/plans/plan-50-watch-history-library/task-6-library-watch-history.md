# task-6-library-watch-history

## 읽어야 할 파일

- AGENTS.md, front/AGENTS.md, _docs/ARCHITECTURE.md의 프론트·Harness 규칙
- 이 폴더의 plan.md, index.json의 task-6 항목, task-2/task-4/task-5 완료 요약
- _docs/api/04-playback/watch-history.md, saved-videos.md와 _docs/api/00-overview/error-code.md
- front/src/screens/LibraryScreen.tsx, AccountScreen.tsx의 탭·카드·직접 진입 경로
- front/src/features/playback/savedVideos.ts, playbackResponses.ts
- front/src/features/user/UserProvider.tsx, sessionClient.ts의 세션·인증 인터페이스
- front/src/common/http/api.ts, errorMessages.ts의 호출·오류 표시 인터페이스
- 구현 전 공식 문서: https://docs.expo.dev/versions/v57.0.0/ 와 https://docs.expo.dev/versions/v57.0.0/sdk/router/
- 구현 시 적용되는 .agents/skills/vercel-react-native-skills/SKILL.md

## 실패 시 참고할 파일

- front/tests/unit/watchHistory.test.ts, libraryScreen.test.ts, savedVideos.test.ts
- front/scripts/test-front.cjs, front/tsconfig.json의 검사 실패 관련 설정

## 작업

depends_on은 task-2·task-4·task-5다. 조회 API·문서, 재생 화면 구현, 보관함 테스트 작성이 끝난 뒤 시청기록 탭을 연결하고 전체 프론트 타입 검사를 수행한다. 이 task는 소스 구현 및 테스트 실행 역할이다. 선행 테스트 task의 파일은 읽기 전용이며, 테스트를 임의 수정하거나 assertion을 약화해 통과시키지 않는다. 테스트 결함은 근거와 함께 별도 수정 범위로 보고한다. 담당 제품 코드를 구현한 뒤 아래 checks를 모두 실행·통과해야 완료한다. 테스트 내부는 실패 분석에 필요한 부분만 읽고, 실행만을 위해 전체를 읽지 않는다. 다른 작업자가 함께 작업하므로 타인의 변경을 되돌리지 않고 아래 파일만 apply_patch로 수정한다.

### 정확한 수정 허용 파일

~~~text
front/src/features/playback/playbackResponses.ts
front/src/features/playback/watchHistory.ts
front/src/features/playback/savedVideos.ts
front/src/screens/LibraryScreen.tsx
~~~


### 구현 지시

1. playbackResponses.ts에 WatchHistoryItem과 WatchHistoryPage를 정의한다. task-2의 정확한 응답 키를 따르고 백엔드 소스 타입을 import하지 않는다. EPISODE/PREVIEW 판별 유니온을 유지해 회차 UUID/번호가 본편에서는 필수, 프리뷰에서는 null임을 표현한다.
2. 저장 목록과 공유하는 영상 메타데이터/판별 유니온이 필요하면 이 파일 내부에서만 최소한으로 분리한다. 기존 SavedVideoItem/SavedVideoPage/SavedContentType export와 응답 필드는 유지한다. 시청기록 항목에 가짜 savedAt을 만들어 저장 타입으로 변환하지 않는다.
3. watchHistory.ts의 getWatchHistory(page=1)는 필수 인증 apiRequest로 /me/watch-history?page=를 GET한다. 기존 세션 클라이언트·오류 메시지·Refresh 규칙을 사용한다.
4. savedVideoRoute의 인자만 SavedVideoItem | WatchHistoryItem으로 넓혀 동일한 contentType 분기·본편/미리보기 이동을 재사용한다. 경로와 params를 바꾸지 않는다. 본편은 기존처럼 episodeUuid/dramaUuid, 프리뷰는 dramaUuid/videoUuid로 이동한다. 본편 재생기나 다른 FULL 선택 기능을 추가하지 않는다.
5. LibraryScreen은 선택 탭에 따라 getSavedVideos 또는 getWatchHistory를 호출한다. 카드 제목·회차/미리보기 라벨·이미지·길이 표시·Pressable·스타일·FlatList·이동 함수를 그대로 사용한다. 기록 진행률·완료 배지·시청 시각 UI를 추가하지 않는다.
6. 포커스/탭/사용자/세션이 바뀌면 요청 generation을 증가시키고 목록·소유자·다음 페이지·오류·로딩 상태를 초기화한다. 현재 소유자는 userUuid/sessionVersion/tab을 함께 가진다. 탭 전환 직후 effect 정리 전 렌더에서도 이전 탭 카드가 보이지 않게 한다.
7. 모든 요청 결과·catch·finally는 현재 generation/세션/사용자/탭에 해당할 때만 상태를 변경한다. 이전 요청의 finally가 새 요청의 inFlight를 해제하거나 새 다음 페이지 오류를 지우지 않게 한다.
8. 추가 로딩은 성공 후에만 nextPage를 증가시키고 실패 시 같은 페이지를 재시도한다. 중복 endReached와 버튼 연타는 단일 inFlight로 막는다. 페이지 사이 기록 정렬 변경으로 같은 videoUuid가 다시 오면 화면에는 한 번만 표시한다.
9. 시청기록 탭의 빈 목록·로딩·첫 페이지 오류·추가 로딩 오류·로그인/복원 상태를 연결한다. 기존 저장 탭 안내는 유지한다. 시청기록은 '시청 기록을 불러오는 중이에요', '시청 기록을 불러오지 못했어요', '시청 기록이 없어요', 로그인 설명은 '시청 기록을 보려면 로그인해 주세요.'를 사용한다. 빈 목록 설명은 '영상을 시청하면 이곳에 표시돼요.'로 한다.
10. 기존 params.tab의 history/시청 기록과 AccountScreen의 직접 진입을 그대로 지원한다. URL params 변경과 사용자 탭 선택 상태의 기존 우선순위를 유지한다. 화면 재진입 시 최신 최근 시청순을 첫 페이지부터 읽는다.


### 주요 로직 코드 또는 변경 예시

응답 타입과 API 호출의 핵심 예시다. 다른 기존 재생 응답 타입은 변경하지 않는다.

~~~ts
type LibraryVideoDetails = {
  videoUuid: string;
  dramaUuid: string;
  dramaTitle: string;
  imageUrl: string | null;
  durationMs: number;
} & (
  | { contentType: 'EPISODE'; episodeUuid: string; episodeNumber: number; episodeTitle: string | null }
  | { contentType: 'PREVIEW'; episodeUuid: null; episodeNumber: null; episodeTitle: null }
);

export type SavedVideoItem = LibraryVideoDetails & { savedAt: string };
export type WatchHistoryItem = LibraryVideoDetails & { lastPlayedAt: string };
export type WatchHistoryPage = {
  items: WatchHistoryItem[];
  page: number;
  hasNext: boolean;
};
~~~

~~~ts
import { apiRequest } from '../user/sessionClient';
import type { WatchHistoryPage } from './playbackResponses';
export type { WatchHistoryItem, WatchHistoryPage } from './playbackResponses';

export function getWatchHistory(page = 1): Promise<WatchHistoryPage> {
  return apiRequest<WatchHistoryPage>(
    '/me/watch-history?page=' + encodeURIComponent(page),
    { auth: 'required' },
  );
}
~~~

LibraryScreen의 기존 상태·FlatList에 연결할 요청 흐름 예시다. 아래 상태와 함수로 기존 단일 저장 탭 제한을 바꾸고 rendering의 소유권에도 tab을 포함한다. 별도 목록 hook이나 전역 store는 만들지 않는다.

~~~tsx
type LibraryItem = SavedVideoItem | WatchHistoryItem;
type ItemsOwner = { uuid: string; version: number; tab: LibraryTab };
const [items, setItems] = useState<LibraryItem[]>([]);
const [itemsOwner, setItemsOwner] = useState<ItemsOwner | null>(null);
const currentTab = useRef(tab);
const currentOwner = useRef(owner);
currentTab.current = tab;
currentOwner.current = owner;

const loadPage = useCallback(async (
  page: number, replace: boolean, requestGeneration: number,
  version: number, userUuid: string, requestTab: LibraryTab,
) => {
  if (inFlight.current) return;
  inFlight.current = true;
  const isCurrentRequest = () =>
    generation.current === requestGeneration &&
    isCurrentSession(version) &&
    currentOwner.current === userUuid &&
    currentTab.current === requestTab;
  if (replace) {
    setStatus('loading');
    setItems([]);
    setItemsOwner(null);
    setError(null);
    setNextError(null);
  } else {
    setNextLoading(true);
    setNextError(null);
  }
  try {
    const result = requestTab === '시청 기록'
      ? await getWatchHistory(page)
      : await getSavedVideos(page);
    if (!isCurrentRequest()) return;
    setItems(current => {
      const merged: LibraryItem[] = replace ? [] : [...current];
      const seen = new Set(merged.map(item => item.videoUuid));
      for (const item of result.items) {
        if (!seen.has(item.videoUuid)) {
          seen.add(item.videoUuid);
          merged.push(item);
        }
      }
      return merged;
    });
    setHasNext(result.hasNext);
    nextPage.current = result.page + 1;
    setItemsOwner({ uuid: userUuid, version, tab: requestTab });
    setStatus('loaded');
    setError(null);
    setNextError(null);
  } catch (error) {
    if (!isCurrentRequest()) return;
    if (replace) {
      setStatus('error');
      setError(error);
    } else setNextError(error);
  } finally {
    if (isCurrentRequest()) {
      inFlight.current = false;
      setNextLoading(false);
    }
  }
}, [isCurrentSession]);

useFocusEffect(useCallback(() => {
  const requestGeneration = ++generation.current;
  inFlight.current = false;
  nextPage.current = 2;
  setItems([]);
  setItemsOwner(null);
  setHasNext(false);
  setError(null);
  setNextError(null);
  setNextLoading(false);
  setStatus('idle');
  if (!isRestoring && owner) {
    void loadPage(1, true, requestGeneration, sessionVersion, owner, tab);
  }
  return () => {
    generation.current += 1;
    inFlight.current = false;
  };
}, [tab, isRestoring, owner, sessionVersion, loadPage]));

const ownsCurrentList = itemsOwner?.uuid === owner &&
  itemsOwner.version === sessionVersion && itemsOwner.tab === tab;
const visibleItems = ownsCurrentList ? items : [];
const loadNextPage = () => {
  if (!ownsCurrentList || !hasNext || nextLoading || status !== 'loaded' ||
      isRestoring || !owner) return;
  void loadPage(nextPage.current, false, generation.current, sessionVersion, owner, tab);
};
const retry = () => {
  if (!isRestoring && owner) {
    void loadPage(1, true, generation.current, sessionVersion, owner, tab);
  }
};
~~~

renderItem에서는 기존 savedVideoRoute(item)을 계속 호출한다. itemsOwner가 현재 탭/계정에 속하지 않으면 기존 항목을 렌더링하지 않고 상태에 맞는 로딩/로그인 안내를 보여준다. 오류 안내는 기존 getErrorMessage(error)를 사용한다.


### 검증 책임

task-5가 작성한 조회·보관함·이동 테스트를 실행한다. 기존 저장/삭제·필수 인증·카드 표시·라우팅을 유지하고 첫/다음 페이지 재시도, 중복 방지, 탭/포커스/사용자/세션별 늦은 응답과 finally 무효화를 검증한다. task-4까지 완료된 상태에서 전체 프론트 typecheck를 마지막에 수행한다. 테스트나 mock 수정은 이 task의 범위가 아니다.

### 검증 명령

~~~text
npm --prefix front run test -- tests/unit/watchHistory.test.ts tests/unit/libraryScreen.test.ts tests/unit/savedVideos.test.ts
npm --prefix front run typecheck
~~~


### 완료 조건과 실행 전제

- 저장한 작품과 시청기록이 같은 카드·이동 함수를 사용하고 기존 저장/삭제 동작과 route가 유지된다.
- API 미완료 항목을 프론트에서 필터링하지 않으며 신규 endpoint의 필수 인증·페이징·빈 목록·재시도·직접 진입이 동작한다.
- 탭·포커스·사용자/세션 전환 후 오래된 카드·응답·finally가 현재 목록 상태를 덮어쓰지 않는다. 선언된 테스트와 typecheck가 모두 통과한다.
- 선택 테스트는 가짜 HTTP/화면 이벤트로 검증하며 실서버를 자동 시작하지 않는다. 브라우저 검증을 추가하면 기존 http://localhost:8081만 사용하고 서버가 없으면 해당 검증 실패 및 npm --prefix front run start -- --port 8081 실행 안내를 남긴다.


### 반복 작업 위임

불가. 응답 타입·세션 요청·목록 상태·탭 전환/늦은 응답·공유 이동 함수는 연결된 설계 판단이 필요하다. 담당 worker가 소스 통합·모든 checks·최종 보고를 맡으며 하위 슬롯은 0개다.
