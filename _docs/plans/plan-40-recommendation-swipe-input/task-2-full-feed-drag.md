# task-2-full-feed-drag

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `_docs/plans/plan-40-recommendation-swipe-input/plan.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 구현 전 Expo 57 공식 문서 및 설치된 React Native·React Native Web의 PanResponder, Pressability, Slider 이벤트 처리를 확인한다. 웹 마우스와 네이티브 터치의 responder/click 취소 차이를 확인한다.

## 작업
추천 피드 전체에서 세로 드래그로 작품을 넘길 수 있게 한다. 버튼 위에서 터치를 시작했다는 이유로 넘김을 막지 않는다. 재생바에서 시작한 터치만 넘김에서 제외하고, 단순 탭은 기존 버튼 동작을 유지한다.

### 정확한 수정 범위
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 위 두 파일만 수정한다. task-1의 정상 전환 로직을 기준으로 한다.
- 휠 이벤트 제외 정책, 220ms RAF 이동, 150ms 휠 종료 판정, 한 작품 제한, 절반 기준, 실제 도착 후 재생 전환, 버퍼·마운트·고유 key·자동 재생 소리 정책을 변경하지 않는다.
- 추천 피드 밖의 내비게이션이나 별도 Modal 화면에 새 작품 넘김 핸들러를 전파하지 않는다. 이 작업의 전체화면은 추천 피드의 영상·텍스트·오버레이 버튼 영역을 뜻한다. 기존 Modal 구성은 유지한다.

### 구현 지시
- 기존 controlTouchHandlers가 모든 버튼의 onTouchStart에서 gestureBlockedRef를 설정하는 처리를 제거한다. 재생바 전용 touch start/end/cancel 및 sliding start/complete에서만 드래그 차단 상태를 관리한다. 이름도 재생바의 책임을 드러내게 바꾼다.
- 재생바에서 시작한 제스처는 세로·가로 어느 방향이든 작품 넘김을 시작하지 않는다. 재생바 밖으로 손이 나가도 해당 터치 종료·취소 전까지 제외한다. 종료·취소·unmount·blur 시 차단 상태를 정리하여 이후 일반 드래그가 막히지 않게 한다.
- 추천 피드 부모에서 수직 이동 10px 이상이고 수평 이동보다 클 때 드래그 소유권을 가져온다. 버튼이 먼저 responder를 잡아도 부모의 onMoveShouldSetPanResponderCapture 등으로 드래그를 인식할 수 있게 하되, 재생바 제외 판정을 먼저 수행한다. touch start에서 무조건 responder를 가져오지 않는다.
- 재생·저장·회차·공유·닫기·속도·작품 상세·본편 보기 등 일반 버튼에서 시작한 세로 드래그는 배경 드래그와 동일하게 처리한다. 컨트롤이 표시된 상태에서도 대부분 영역에서 드래그가 가능해야 한다.
- 드래그로 판정된 터치의 버튼 onPress/click은 취소한다. 웹에서 responder 종료 후 발생할 수 있는 합성 click도 동일 제스처에 한해서 억제한다. 그다음 독립적인 정상 탭을 삼키거나, 단순 이동으로 버튼을 실행하는 지연 타이머를 추가하지 않는다.
- 드래그 임계값 미만의 탭은 기존 onPress 한 번만 실행한다. 영상 배경 탭의 컨트롤 표시/숨김도 유지한다. 가로 이동을 세로 작품 이동으로 해석하지 않는다.
- 기존 PanResponder grant/move/release/terminate와 공유 이동 함수에 연결하고 별도 보정·이동 루트를 추가하지 않는다. 전환 중 입력 잠금도 유지한다.

### 주요 로직 코드 또는 변경 예시
부모에서 드래그 소유권을 가져올 수 있도록 하고, 차단 여부는 재생바에만 연결한다. 아래 함수 이름은 현재 화면의 명명에 맞게 조정한다.

```tsx
const panResponder = useMemo(() => PanResponder.create({
  onStartShouldSetPanResponder: () => false,
  onMoveShouldSetPanResponderCapture: (event, gesture) =>
    panCallbacksRef.current.shouldStart(event, gesture),
  onMoveShouldSetPanResponder: (event, gesture) =>
    panCallbacksRef.current.shouldStart(event, gesture),
  onPanResponderGrant: (event, gesture) => panCallbacksRef.current.grant(event, gesture),
  onPanResponderMove: (event, gesture) => panCallbacksRef.current.move(event, gesture),
  onPanResponderRelease: (event, gesture) => panCallbacksRef.current.release(event, gesture),
  onPanResponderTerminate: (event, gesture) => panCallbacksRef.current.terminate(event, gesture),
  onPanResponderTerminationRequest: () => false,
}), []);

// 일반 버튼에는 이 touch handler를 붙이지 않고 Slider에만 적용한다.
const seekTouchHandlers = {
  onTouchStart: () => onSeekTouch(true),
  onTouchEnd: () => onSeekTouch(false),
  onTouchCancel: () => onSeekTouch(false),
};
// 기존 Slider에 통합하고 탐색 중 컨트롤 숨김 타이머도 기존처럼 중지한다.
<Slider {...seekTouchHandlers}
  onSlidingStart={() => { onSeekTouch(true); seeking.current = true; clearHideTimer(); }}
  onSlidingComplete={(value) => {
    player.currentTime = value;
    seeking.current = false;
    onSeekTouch(false);
    showControls();
  }}
/>;
```

- shouldStart의 차단 조건은 slider/seek 터치에만 적용한다. 드래그가 버튼의 press를 취소하는 부분은 실제 RN/RNW 이벤트 순서에 맞춰 구현하고 검증한다. capture 추가만으로 웹 click 취소까지 자동 보장된다고 가정하지 않는다.

### 회귀 테스트와 완료 조건
- 배경·제목 텍스트·중앙 재생 버튼·우측 저장/회차/공유·상단 버튼·하단 버튼에서 시작한 세로 드래그가 같은 경로로 한 작품 이동하는지 검증한다.
- 자식 Pressable이 먼저 responder를 가진 상황에서 부모 capture 판정과 takeover/취소를 검증한다. 부모 callback만 직접 호출해 통과시키지 말고 버튼의 실제 handler 연결도 검증한다.
- 버튼에서 드래그한 뒤 navigation/share/save/play 등 해당 버튼 부작용은 0회이고, 별도의 짧은 탭에서는 정확히 1회인지 검증한다. 웹 후속 click 억제 후 다음 정상 탭은 실행돼야 한다.
- 재생바 touch start/sliding start → 세로 드래그는 작품 이동 0회, 가로 seek는 정상 currentTime 변경, touch end/cancel/sliding complete 뒤 피드 드래그 복구를 확인한다.
- 재생바에서 시작한 채 밖으로 이동, 취소 및 blur 후 재진입에서도 제외 상태가 고착되지 않는지 검증한다.
- 웹 포인터와 iOS/Android 터치에 해당하는 입력을 각각 검증한다. 10px 미만·수평 우세·전환 중 입력 잠금·반 페이지 원위치 복귀·정착 후 재생 등 기존 검증을 보존한다.
- 재생바 외의 버튼 전체에 넘김 차단용 onTouchStart가 남지 않도록 한다. 스타일이나 버튼 면적을 임의 축소해 문제를 우회하지 않는다.

### 검증 명령
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 기존 `http://localhost:8081`에 현재 코드가 반영된 상태에서 배경·버튼 위 드래그, 버튼 탭, 재생바 조작을 실제 확인한다. 가능한 iOS/Android 환경에서도 동일하게 확인한다. 자동 검사·HTTP 200·export와 실제 조작 검증 결과를 구분한다.
- 서버가 없으면 화면 검증 실패와 `npm --prefix front run start -- --port 8081` 안내를 기록한다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. 브라우저·기기 조작이 불가능하면 미검증으로 명시한다.
