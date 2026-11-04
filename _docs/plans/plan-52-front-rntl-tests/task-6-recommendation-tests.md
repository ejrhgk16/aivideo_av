# task-6-recommendation-tests

## 기본 입력

- 이 task 문서와 index.json의 task-6 항목.
- 컨텍스트로 전달된 루트·front 적용 지침 및 선행 task 완료 요약. 다른 작업자가 함께 작업하므로 다른 task의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- front/tests/unit/recommendationPreviewBuffer.test.ts의 모든 버퍼/화면/웹/gesture 시나리오와 FakePlayer/가짜 실행기에서 사용한 입력·기대값. React/트리 실행 코드는 재사용하지 않는다.
- front/src/features/playback/recommendationPreviewBuffer.ts의 공개 manager API와 player interface, watchProgress.ts의 tracker 공개 계약.
- front/src/screens/RecommendationScreen.tsx의 export props, 선택/buffer effect, scroll/resize/animation/drag/wheel/DOM listener, 저장 경합·진행 기록 구간.
- front/src/features/home/homeResponses.ts, drama/dramaResponses.ts, playback/playbackResponses.ts의 fixture 타입.
- task-1의 video helper 공개 API와 setup의 cleanup 규칙. 설치된 RNTL 13 render/createNodeMock 및 expo-router renderRouter의 RenderOptions 전달 계약.

## 필요 시 참고할 문서

- 전달된 적용 지침이 누락되었거나 변경되었을 때만 AGENTS.md와 front/AGENTS.md의 테스트·셸 규칙을 확인한다.
- 테스트/제품 책임 경계 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend와 Boundaries를 확인한다.
- 이 문서의 승인 계약이 누락되거나 충돌할 때만 plan.md의 승인된 계약 및 기능별 검증 대응을 확인한다. 전체 plan 재독은 필요하지 않다.

## 실패 시 참고할 파일

- task-7이 전달한 실패에 따라 해당 테스트의 이벤트 payload와 RecommendationScreen의 직접 해당 handler/effect만 읽는다. support/video 또는 공통 config 결함은 task-1에 보고한다.

## 작업

혼합된 순수 버퍼·추천 화면 테스트를 .test.tsx로 이전한다. 버퍼 함수는 실제 import/Jest로, 화면은 실제 React/RNTL로 실행한다. 기존 함수/객체 트리 수동 렌더링은 전부 제거한다.

### 보존 계약

- 이전·현재·다음 최대 3개 player 재사용, 왕복 이동 시 URL 요청 공유, 창 밖/blur/실패 응답 무시와 재진입 재요청.
- eviction/dispose 시 구독 먼저 제거 후 VideoView detach 뒤 pending release, loading 중 0 seek 예약·ready에서 반영.
- idle web player를 렌더링하여 ready/first frame 이벤트를 받을 수 있음, 현재/이웃/실패 상태 표시.
- collection reorder/remove/empty/same-order와 in-flight 이동의 정렬·선택·stale scroll 처리. 실제 도착 전에는 선택/재생 전환하지 않음.
- drag의 거리·최근 속도·방향·신선도·가장자리·취소·절반 페이지, 컨트롤과 배경 터치 보존. 드래그 뒤 web click만 억제하고 다음 tap/keyboard는 동작.
- wheel deltaMode/threshold·수평/interactive target 제외·모션 중 inertia·도착과 150ms quiet 양쪽 완료·animation/quiet 완료 순서, 실패 player 뒤 다음 gesture 허용.
- resize의 content size 대기·마지막 카드 offset 보정·첫 카드 불필요한 scroll 대기 방지·actual offset 기준 갱신, blur/resize 후 stale animation frame 취소.
- 첫 preview UUID 저장, UI remount 뒤 값 유지, pause 저장/해제 후 자동 재생 없음, A→B→A 저장 직렬화와 focus read/write 경합, 실패 후 잠금 해제.
- 선택된 실제 진행 preview만 서버 duration으로 기록하고 buffer/blur/seek/기타 카드의 이벤트는 기록하지 않음.

### 구현 지시

- 순수 buffer tests는 React 없이 실제 manager와 task-1 player를 사용한다. listenerCount와 remove/release 순서도 assert한다. 화면 테스트의 useUser/API 입력만 mock하고 manager/tracker는 실제 구현을 사용한다.
- native 화면은 실제 FlatList/PanResponder를 사용하는 RNTL 트리에서 네이티브 scroll/layout/responder 이벤트를 주입한다. scrollToOffset 같은 host imperative 작업에 한정 spy/createNodeMock을 쓰고 request와 actual arrival 이벤트를 구분한다. 필요 시 JS native view 경계 mock을 최소화하되 화면/React/PanResponder 전체 알고리즘을 가짜로 바꾸지 않는다.
- 이 파일 상단에 @jest-environment jsdom을 선언하여 실제 DOM Element/EventTarget/WheelEvent/MouseEvent를 사용한다. web Platform은 필요한 테스트에서만 spy/프로퍼티 교체로 설정하고 복원한다. @react-native와 react-native-web 렌더러를 혼합하지 않는다.
- renderRouter에 createNodeMock을 전달해 host View ref의 DOM listener 경계를 제공한다. feed ref에는 실제 HTMLElement를 주고 addEventListener/removeEventListener를 실제 실행한다. 별도 domListeners Map·FakeElement.closest·가짜 DOM 전파 엔진을 작성하지 않는다. 검사할 native ref를 구분하여 list/다른 View ref를 같은 DOM node로 잘못 대체하지 않는다.
- scrollToOffset 호출 기록과 명시적 actual scroll event로 이동을 검증한다. 실제 브라우저 배치/스크롤을 검사한다고 보고하지 않는다. 드래그 뒤 click 억제는 DOM native listener 수준 assertion이며 browser E2E가 아니다.
- requestAnimationFrame/performance.now/setTimeout은 Jest fake timer의 단일 시간축으로 제어한다. frame callback/quiet 경계는 act와 advanceTimersByTimeAsync로 진행한다. 즉시 모든 timer를 끝내서 도착·quiet 조건을 생략하지 않는다.
- session/blur/unmount/resize 이후 구독·timer·DOM listener 정리를 관찰한다. 테스트마다 DOM 노드와 spy, Platform·clock을 정리한다.

### 역할과 완료 조건

테스트 작성 역할이다. 제품 src와 공통 실행기/setup/helper는 수정하지 않는다. 원본 최상위·하위 시나리오 전부를 이전 테스트와 대응시키고 완료 요약에 기존/새 이름과 관찰 방식 변경 사유를 적는다. 원본 .test.ts 삭제와 새 .test.tsx 작성을 모두 이 task가 담당한다. 가짜 렌더러에 묶인 내부 구조 관찰을 공개 결과·명시적인 native 경계 관찰로 바꾸되 의미·경계값·실패 조건을 약화하지 않는다. 작성 완료는 기능 통과가 아니다. 실제 선택·전체 검증은 task-7이 수행한다. 통합 시 결함이 보고되면 해당 작성 task의 파일 범위에서 수정한다. 공유 지원 API의 결함은 task-1 소유자에게 보고한다.


### 수정 허용 파일

- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- `front/tests/unit/recommendationPreviewBuffer.test.tsx`

### 의존성과 checks

- depends_on: task-1.

checks: []. 적절한 독립 정적 TS 검사 명령이 없으므로 테스트 실행 없이 계약·시나리오 검토 결과를 완료 요약에 기록한다. 전체 타입·동작 검증은 task-7에 배정한다.

### 반복 작업 위임

불가. 각 플랫폼 이벤트·비동기 경합·생명주기 판단이 필요하여 독립적인 반복 치환으로 볼 수 없다. task-2~6은 최대 5개 부모 worker로 병렬 실행하며 공통 설정/지원 파일은 읽기 전용이다. 하위 에이전트를 생성하지 않는다.

### 주요 로직 코드 또는 변경 예시

버퍼의 실질적인 수명주기 검증 예시다. 기존 여섯 순수 버퍼 시나리오를 모두 이식한다.

```tsx
import { setImmediate } from 'node:timers';
import { createRecommendationPreviewBuffer } from '@/features/playback/recommendationPreviewBuffer';
import { createMockVideoPlayer } from '../support/video';

test('evicted players are released only after the view is detached', async () => {
  const buffer = createRecommendationPreviewBuffer(
    async (_dramaId, videoId) => ({ url: videoId }),
    createMockVideoPlayer,
    jest.fn(),
  );
  const first = { dramaId: 'drama-1', videoId: 'preview-1' };
  buffer.retain([first]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const player = buffer.get(first)!.player!;
  buffer.retain([{ dramaId: 'drama-2', videoId: 'preview-2' }]);
  expect(player.release).not.toHaveBeenCalled();
  buffer.releasePending();
  expect(player.release).toHaveBeenCalledTimes(1);
  buffer.dispose();
  buffer.releasePending();
});
```

웹 경계도 실제 화면을 먼저 렌더링한 후 listener 등록과 입력의 결과를 검증한다. 아래는 interactive target의 wheel을 가로채지 않는 전체 핵심 시퀀스다. 같은 파일의 기존 gesture/arrival/quiet/resize 시나리오도 위 계약대로 모두 작성한다.

```tsx
/** @jest-environment jsdom */
import { Platform } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { RecommendationScreen } from '@/screens/RecommendationScreen';
import { getHomeCollection } from '@/features/home/homeContent';
import { getDramaContent } from '@/features/drama/dramaContent';
import { useUser } from '@/features/user/UserProvider';

jest.mock('@/features/home/homeContent', () => ({ getHomeCollection: jest.fn() }));
jest.mock('@/features/drama/dramaContent', () => ({ getDramaContent: jest.fn() }));
jest.mock('@/features/playback/previewPlayback', () => ({ getPreviewPlayback: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));

const session: ReturnType<typeof useUser> = {
  user: null,
  points: null, accessToken: null, isRestoring: false,
  restoreError: null, sessionExpired: false, sessionVersion: 1,
  subtitlesEnabled: true, autoplayNext: false,
  setUser: jest.fn(), setPoints: jest.fn(), login: jest.fn(), logout: jest.fn(),
  dismissSessionExpired: jest.fn(), isCurrentSession: (version) => version === 1,
  setSubtitlesEnabled: jest.fn(), setAutoplayNext: jest.fn(),
};

test('web wheel leaves interactive targets alone and removes its listener', async () => {
  const oldPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  const feed = document.createElement('div');
  const interactive = document.createElement('button');
  feed.append(interactive);
  const addListener = jest.spyOn(feed, 'addEventListener');
  const removeListener = jest.spyOn(feed, 'removeEventListener');
  try {
    jest.mocked(useUser).mockReturnValue(session);
    jest.mocked(getDramaContent).mockResolvedValue({
      uuid: 'drama-1', slug: 'one', title: '추천 예시', shortDescription: '', synopsis: '',
      productionCompany: null, genres: [],
      imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
      previewVideos: [], episodes: [],
    });
    jest.mocked(getHomeCollection).mockResolvedValue({
      code: 'RECOMMENDATION_DAILY', title: '추천', description: null,
      dramas: [{
        uuid: 'drama-1', slug: 'one', title: '추천 예시', shortDescription: '',
        displayOrder: 1, productionCompany: null, genres: [],
        imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
        previewVideos: [], publishedEpisodeCount: 1, freeEpisodeCount: 1,
      }],
    });
    const view = renderRouter({ index: RecommendationScreen }, {
      createNodeMock: (element) => {
        const props = element.props as { onLayout?: unknown; onMoveShouldSetResponder?: unknown };
        return props.onLayout && props.onMoveShouldSetResponder ? feed : null;
      },
    });
    await waitFor(() => expect(addListener).toHaveBeenCalledWith(
      'wheel', expect.any(Function), { passive: false },
    ));
    const ignored = new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: 120, deltaMode: 0,
    });
    act(() => { interactive.dispatchEvent(ignored); });
    expect(ignored.defaultPrevented).toBe(false);
    const handled = new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: 120, deltaMode: 0,
    });
    act(() => { feed.dispatchEvent(handled); });
    expect(handled.defaultPrevented).toBe(true);
    view.unmount();
    expect(removeListener).toHaveBeenCalledWith('wheel', expect.any(Function));
  } finally {
    Object.defineProperty(Platform, 'OS', oldPlatform);
    feed.remove();
  }
});
```

createNodeMock의 feed 식별 조건은 실제 native host로 전달되는 responder/layout prop을 기준으로 하고, 해당 node에만 ref를 제공한다. 실제 스크롤 이동 시나리오는 이 경계 등록 검증에 더해 layout/contentSize/scroll 이벤트와 fake timer를 공급해 actual arrival 전후의 선택·재생을 각각 확인한다. 별도의 가짜 DOM 엔진이나 React 실행 루프를 만들지 않는다.

