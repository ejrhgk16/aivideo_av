# task-5-resize-alignment

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `_docs/plans/plan-40-recommendation-swipe-input/plan.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 구현 전 Expo 57 공식 문서 및 설치된 RN/RNW FlatList·VirtualizedList·ScrollView의 onLayout, onContentSizeChange, scrollToOffset 처리를 확인한다.

## 작업
화면 크기 변경 시 카드의 새 크기와 스크롤 범위가 반영된 뒤 현재 확정 작품 위치로 정렬한다. 마지막 작품에서 화면을 키워도 화면과 activeId·재생·컨트롤이 같은 작품을 가리키게 한다.

### 정확한 수정 범위
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 위 두 파일만 수정한다. 웹·iOS·Android 공통 레이아웃 흐름에 적용한다.
- 기존 빠른 스와이프·느린 절반 드래그·재생바 제외·터치 대상 유지·휠 입력·220ms 전환·150ms 휠 묶음·버퍼·재생 정책은 보존한다.
- 새 의존성·범용 레이아웃 추상화·다른 화면·백엔드는 변경하지 않는다.

### 확인할 결함
- 현재 feed onLayout은 stopMotion 뒤 새 높이로 scrollToOffset을 먼저 요청하고 그 후 setCardHeight를 호출한다.
- 마지막 카드에서 높이가 커지면 목표 offset이 이전 콘텐츠의 최대 스크롤 범위를 초과해 브라우저/네이티브가 요청을 제한할 수 있다. 카드가 새 높이로 렌더링된 뒤 별도 정렬이 없어 작품 사이에 걸린다.
- 요청 offset만 검사한 기존 테스트로는 실제 제한된 위치를 확인할 수 없다. 실제 offset 및 카드/컨테이너 크기 반영을 나눠 검증한다.

### 구현 지시
- onLayout에서 기존 높이가 바뀌면 진행 중 드래그·RAF·휠을 기존 세대 취소 흐름으로 정리하고 새 높이의 정렬 대기를 기록한다. 아직 옛 카드 크기인 이 시점에는 최종 정렬 scrollToOffset을 요청하지 않는다.
- setCardHeight로 카드와 getItemLayout을 갱신한 뒤 FlatList onContentSizeChange 등 실제 콘텐츠 크기 통지를 사용해 최신 높이가 반영됐는지 확인한다. useEffect 또는 단일 RAF 실행만으로 네이티브 콘텐츠 측정 완료를 가정하지 않는다.
- 이 화면은 모든 카드가 cardHeight이고 헤더/간격이 없으므로 기대 콘텐츠 높이는 작품 수 × 최신 cardHeight다. 콘텐츠 크기 통지가 최신 기대 크기와 허용 오차 내에서 일치할 때 정렬한다. 오래된 더 큰 콘텐츠 크기를 단순히 >= 비교해 최신 크기로 오인하지 않는다.
- 정렬 목표는 마지막 확정 작품의 인덱스 × 새 cardHeight이며 animated:false로 한 번 요청한다. 정렬을 새 작품 넘김이나 새 애니메이션으로 처리하지 않는다.
- requestedOffsetRef와 actualOffsetRef는 구별한다. 실제 onScroll 통지 또는 플랫폼의 실제 offset 측정으로 목표 도착을 확인한 뒤 정렬 대기를 해제한다. 요청만으로 actualOffsetRef를 목표값으로 덮어쓰지 않는다. 이미 실제 위치가 목표인 첫 카드 정렬은 불필요한 이벤트를 무한 대기하지 않게 한다.
- 정렬 대기 중 새 드래그·휠이 이전 범위로 이동을 시작하지 않도록 막되, 실제 정렬 완료 후 새 독립 입력은 정상 처리한다. 고정 대기 시간으로 해결하지 않는다.
- 빠른 연속 크기 변경에서는 가장 최근 높이·세대만 유효하다. 이전 콘텐츠 통지·RAF·onScroll이 정렬을 확정하거나 이전 목표로 되돌리지 않게 한다. blur·unmount 때 대기와 콜백을 무효화한다.
- 크기 변경 중 activeId와 사용자 재생/일시정지·currentTime을 유지한다. 이전 작품 resetToBeginning이나 자동 재생 effect 재시작을 추가하지 않는다.
- 재진입 정렬이 새 크기 반영 전 선행하지 않게 기존 focus 정렬과 통합한다. 현재 크기가 이미 유효한 일반 focus 복귀는 보존한다.
- 콘텐츠 크기 확정 후 한 번 정렬하는 흐름으로 유지한다. 매 scroll 이벤트에서 반복 정렬하거나 잔움직임을 일으키는 사후 보정 루프를 추가하지 않는다.

### 주요 로직 코드 또는 변경 예시
현재 화면의 ref·세대·stopMotion과 통합하는 핵심 흐름이다. 정렬 완료 처리는 handleScroll에서 실제 offset 도착을 확인하는 경로에도 연결한다.

```tsx
type PendingAlignment = { height: number; generation: number; requested: boolean };
const pendingAlignmentRef = useRef<PendingAlignment | null>(null);

const beginResize = (height: number) => {
  stopMotion();
  pendingAlignmentRef.current = { height, generation: generationRef.current, requested: false };
  cardHeightRef.current = height;
  setCardHeight(height);
};

const handleContentSizeChange = (_width: number, contentHeight: number) => {
  const pending = pendingAlignmentRef.current;
  if (!pending || !focusedRef.current || pending.generation !== generationRef.current || pending.requested) return;
  const expected = dramasRef.current.length * pending.height;
  if (Math.abs(contentHeight - expected) > PAGE_SETTLE_TOLERANCE) return;
  pending.requested = true;
  const target = committedIndexRef.current * pending.height;
  setRequestedOffset(target);
  if (Math.abs(actualOffsetRef.current - target) <= PAGE_SETTLE_TOLERANCE) {
    pendingAlignmentRef.current = null;
  }
};

const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  actualOffsetRef.current = event.nativeEvent.contentOffset.y;
  const pending = pendingAlignmentRef.current;
  if (pending) {
    const target = committedIndexRef.current * pending.height;
    if (pending.requested && pending.generation === generationRef.current
      && Math.abs(actualOffsetRef.current - target) <= PAGE_SETTLE_TOLERANCE) {
      pendingAlignmentRef.current = null;
    }
    return;
  }
  finishIfArrived();
};
```

- 예시는 최신 카드 높이에 대응하는 콘텐츠 크기 확인과 실제 offset 확인을 분리한다. 구현에서는 초기 layout·기존 focus·연속 resize도 같은 최신 크기 정보를 사용한다.

### 회귀 테스트와 완료 조건
- 기존 하네스에 실제 콘텐츠 높이·viewport 높이와 scrollToOffset의 범위 제한을 모의한다. 단순 요청 배열의 마지막 값만 확인하지 않는다.
- 4작품 이상에서 마지막 카드에 정착시킨 뒤 viewport/cardHeight를 500→800으로 키운다. 옛 콘텐츠 크기에서는 요청이 제한될 수 있음을 재현하고, 수정 후에는 새 콘텐츠 크기 통지 이후에만 정렬 요청이 발생하는지 확인한다.
- 새 콘텐츠 높이 3200·viewport 800에서 실제 offset이 2400에 도착하고 activeId는 마지막 작품, 재생·컨트롤도 같은 작품임을 검증한다. 크기 변경만으로 player play/pause/reset이나 currentTime 변화가 없어야 한다.
- 첫 카드·중간 카드·마지막 카드의 확대/축소를 확인한다. 목표가 이미 0인 경우 onScroll이 없어도 영구 대기하지 않는지 확인한다.
- 500→800→600 연속 변경 뒤 늦게 도착하는 800 크기의 콘텐츠 통지와 예전 scroll/RAF가 최신 목표를 덮어쓰지 않는지 검증한다.
- 정렬 대기 중 입력은 추가 전환을 만들지 않고 실제 완료 후 새 스와이프/휠은 정상 동작해야 한다. blur/재진입, 애니메이션 도중 resize, 재생바 잠금 정리도 검증한다.
- 기존 resize 테스트를 '요청 offset 확인'에서 실제 콘텐츠 크기 확정 및 actual offset 확인으로 갱신한다. 기존 빠른 스와이프·터치 대상 유지·재생·버퍼 회귀 테스트를 보존한다.

### 검증 명령과 실제 화면 확인
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 기존 `http://localhost:8081/recommend`에서 실제 Chrome/CDP로 마지막 카드까지 이동한 뒤 viewport 높이를 키워 확인한다. 실제 scrollTop, scrollHeight, clientHeight, 마지막 카드 위치와 현재 작품을 함께 확인한다. 요청값이나 HTTP 200만으로 통과 처리하지 않는다.
- 가능하면 iOS/Android에서 회전·레이아웃 크기 변경을 확인한다. 환경이 없으면 네이티브 실조작은 미검증으로 명시한다.
- 서버가 없으면 실제 화면 검증 실패와 `npm --prefix front run start -- --port 8081` 안내를 기록한다. 서버 자동 실행·다른 포트 우회는 하지 않는다.
