# task-1-sequential-video

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/features/playback/recommendationPreviewBuffer.ts`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- `front/scripts/test-front.cjs`
- 구현 전 Expo 57 공식 문서 및 해당 버전 expo-video 문서를 확인한다.

## 작업
스크롤을 유지하면서 한 입력당 최대 한 작품만 이동한다. 드래그 중 현재 영상은 계속 재생하고, 다음 작품으로 이동이 완료됐을 때만 재생 대상을 전환한다. 준비된 영상에는 표지가 끼어들지 않게 한다.

### 정확한 수정 범위
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 위 두 파일만 수정한다. 버퍼 모듈, 테스트 실행기, 의존성, 다른 화면을 수정하지 않는다.

### 이동과 재생 상태
- 스크롤 위치는 화면 이동에 사용한다. 재생 대상은 별도의 확정 상태인 activeId로 관리하며, 드래그 중 위치만으로 변경하지 않는다.
- 손가락을 따라 천천히 화면을 넘길 수 있어야 한다. 입력 방향만 감지해 즉시 다음 화면으로 전환하는 방식으로 바꾸지 않는다.
- 입력 시작 시 확정 인덱스를 고정하고 목표를 이전·현재·다음 중 하나로 제한한다. 긴 드래그·빠른 스와이프·휠 관성에도 한 입력당 한 작품까지만 이동한다. 처음과 끝에서 순환하지 않는다.
- 작은 드래그 후 복귀하면 현재 영상의 재생 위치와 사용자 재생·일시정지 상태를 그대로 유지한다.
- 드래그 및 관성 이동 중 현재 영상을 계속 재생한다. 이동 중이라는 이유로 pauseAll을 호출하거나 자동 재생 effect를 재시작하지 않는다. 사용자가 이미 일시정지한 영상은 그대로 일시정지 상태를 유지한다.
- 목표 페이지에 실제 화면이 정착한 뒤에만 activeId를 변경한다. 그때 이전 영상을 정지·처음으로 초기화하고 준비된 다음 영상만 자동 재생한다. 다음 영상 준비 전이면 검은 배경을 표시하며 준비 후 해당 영상이 여전히 현재 작품일 때만 재생한다.
- 인덱스뿐 아니라 실제 스크롤 위치도 제한된 목표 페이지와 일치해야 한다. 가능한 기본 스냅 설정과 FlatList ref를 활용하되, 먼 페이지까지 갔다가 순간적으로 되돌아오는 방식으로 완료 처리하지 않는다.
- 드래그 시작·종료, 관성 시작·종료, 타이머 및 보정 스크롤이 한 입력을 두 번 처리하지 않도록 입력 상태를 공유한다. 드래그 중 잠시 이벤트가 끊겨도 정착 타이머로 중간 확정하지 않는다.
- 웹 휠은 drag 콜백 없이 발생할 수 있다. 한 번의 휠과 그 관성 이벤트를 한 입력 묶음으로 처리한다. 전환 완료 후에도 남아 있는 같은 입력의 관성은 추가 이동을 만들지 않는다. 독립적인 다음 입력은 정상적으로 한 작품 이동한다.
- 중복 방지는 영상 로딩 완료와 무관하다. 영상이 로딩 중이거나 실패해도 새 독립 입력으로 다음 작품에 이동할 수 있다. 애니메이션 중 같은 입력은 추가 이동하지 않으며, 새 입력을 무기한 잠그거나 긴 고정 대기 시간을 강제하지 않는다.
- 화면 이탈 시 입력·정착 타이머를 정리하고 기존 세대 검사로 늦은 콜백을 무효화한다.

### 영상 표시 규칙
- 버퍼의 kind: ready는 플레이어 생성 완료다. 실제 준비 여부는 player.status와 statusChange의 readyToPlay로 추적한다. 이벤트가 속성 갱신보다 먼저 발생하는 기존 동작을 유지한다.
- 준비된 이전·현재·다음 영상은 스크롤 중에도 해당 작품 카드 위치에 표시한다. 영상 레이어와 컨트롤 표시 조건을 분리한다. 현재 영상은 이동 중에도 재생하고 이웃 영상은 정지 상태로 표시한다.
- 공통 영상 레이어를 유지한다면 각 영상 위치를 작품 인덱스 * cardHeight - 실제 scrollY로 맞추고 카드 높이로 제한한다. 다른 작품 영상이 비치지 않게 한다. 안정된 key로 VideoView와 플레이어를 재사용한다.
- 준비된 카드에는 표지를 렌더링하지 않는다. 준비 전에는 검은 배경, 영상 없음·실패 시에는 기존 표지 또는 대체 배경을 표시한다.
- 이동 중 컨트롤은 숨길 수 있으나 현재 영상의 재생 상태는 변경하지 않는다. 슬라이더·버튼 조작이 넘김 제스처로 처리되지 않게 한다.
- 기존 인접 영상 사전 로딩, 화면 이탈 시 정지·해제, 늦은 응답 무시, 사용자 일시정지 유지 동작을 보존한다.

### 주요 로직 코드 또는 변경 예시
아래는 입력 기준 인덱스와 재생 인덱스를 분리하는 핵심 흐름이다. 기존 화면의 스크롤·버퍼·재생 effect에 통합한다. commitSettledPage는 제한된 목표 위치와 실제 화면 위치가 일치하고 드래그·관성 이동이 종료된 후에만 호출한다.

```tsx
type PageInput = { startIndex: number; targetIndex: number | null };
const pageInput = useRef<PageInput | null>(null);

const beginPageInput = () => {
  if (pageInput.current) return;
  const startIndex = dramasRef.current.findIndex((drama) => drama.uuid === activeIdRef.current);
  if (startIndex < 0) return;
  pageInput.current = { startIndex, targetIndex: null };
  setScrolling(true);
};

const chooseTarget = (offsetY: number) => {
  const input = pageInput.current;
  const height = cardHeightRef.current;
  if (!input || height <= 0) return null;
  if (input.targetIndex !== null) return input.targetIndex;
  const proposed = Math.round(offsetY / height);
  input.targetIndex = Math.max(0, Math.min(
    dramasRef.current.length - 1,
    Math.max(input.startIndex - 1, Math.min(input.startIndex + 1, proposed)),
  ));
  return input.targetIndex;
};

const commitSettledPage = (targetIndex: number) => {
  const next = dramasRef.current[targetIndex];
  if (!next) return;
  const previous = dramasRef.current.find((drama) => drama.uuid === activeIdRef.current);
  if (next.uuid !== activeIdRef.current) {
    const preview = previous?.previewVideos[0];
    if (previous && preview) {
      bufferRef.current?.resetToBeginning({ dramaId: previous.uuid, videoId: preview.uuid });
    }
    activeIdRef.current = next.uuid;
    setActiveId(next.uuid);
  }
  setScrolling(false);
};
```

- onScrollBeginDrag에서 입력을 시작한다. onScroll은 시각적 위치만 갱신하고 드래그 없는 웹 입력도 처리한다. onMomentumScrollBegin은 시작 기준 인덱스를 덮어쓰지 않는다.
- 목표 선택 후 실제 위치를 한 페이지 범위 안에서 스냅하고, 이동 종료를 확인해 한 번만 commitSettledPage를 호출한다. 보정 이벤트를 새 입력으로 취급하지 않는다. 같은 휠 관성까지 종료된 뒤 입력 상태를 해제한다.
- 자동 재생 effect에서 scrolling을 중단·재시작 조건으로 사용하지 않는다. 포커스·확정 작품·플레이어 준비 상태가 재생을 결정한다. 같은 작품으로 복귀하면 일시정지를 임의로 풀거나 처음으로 되돌리지 않는다.
- 준비 상태 이벤트는 React state를 갱신해 렌더링에 반영한다. 표시 판정과 위치 예시는 다음과 같다.

```tsx
const showVideo = screenFocused && entry?.kind === 'ready' && preparedKeys.has(key);
const showPoster = !hasPreview || entry?.kind === 'unavailable';
const showControls = showVideo && !scrolling && activeId === drama.uuid;
const videoTop = dramaIndex * cardHeight - scrollY;
```

### 회귀 테스트와 완료 조건
- 드래그 중 offset이 바뀌어도 activeId와 현재 플레이어가 유지되고 재생 중인 영상이 pause되지 않는다.
- 다음 페이지로 정착한 뒤에만 이전 영상이 정지·초기화되고 준비된 다음 영상이 재생된다. 중간 위치에서는 이웃 영상이 재생되지 않는다.
- 작은 드래그 후 복귀하면 기존 재생 위치와 사용자 일시정지가 유지된다.
- 4작품 이상의 데이터에서 긴 입력이 한 작품까지만 이동한다. 역방향, 첫·마지막 작품도 검증한다.
- 드래그·관성 종료·늦은 타이머·보정 이벤트가 겹쳐도 두 번 이동하지 않는다. 드래그 중 타이머로 확정하지 않는다. 다음 독립 입력으로 추가 한 작품 이동이 가능하다.
- 웹 drag 없는 휠 이벤트 열과 관성을 검증한다. 영상 로딩 중·실패 상태에서도 다음 독립 입력으로 이동할 수 있다.
- 준비된 카드에 Image가 없고 이동 중에도 해당 위치에 영상이 표시된다. loading 플레이어는 준비 완료로 취급하지 않는다. ready 이벤트 후 표시가 갱신된다.
- 준비 전 검은 배경, 영상 없음·실패 시 표지, 인접 플레이어 비재생, VideoView 재사용, blur 후 정지·해제, 사용자 일시정지 유지를 검증한다.
- 기존 FlatList 화면 하네스와 FakePlayer를 필요한 만큼 수정한다. 이전의 'scrolling이면 정지·표지' 기대값은 승인된 동작으로 변경한다.

### 검증 명령
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 실행 중인 http://localhost:8081에 현재 코드가 반영됐는지 확인하고 느린 드래그 중 재생 유지, 덜 넘긴 뒤 복귀, 정착 후 재생 전환, 긴 입력의 한 작품 이동, 준비된 영상의 표지 생략을 확인한다. 단위 테스트와 실제 화면 확인 결과를 구분한다.
- 서버가 미실행이면 시각 검증 실패로 기록하고 `npm --prefix front run start -- --port 8081`을 안내한다. 자동 실행하거나 다른 포트를 사용하지 않는다. 네이티브 확인을 못 했다면 미검증으로 명시한다.
