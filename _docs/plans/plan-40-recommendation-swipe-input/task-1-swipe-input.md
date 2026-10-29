# task-1-swipe-input

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `_docs/plans/plan-40-recommendation-swipe-input/plan.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/features/playback/recommendationPreviewBuffer.ts`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- `front/scripts/test-front.cjs`
- `front/package.json`
- 구현 전 Expo 57 공식 문서, 해당 React Native의 PanResponder·FlatList 문서, 설치된 react-native-web의 ScrollView 구현을 확인한다.
- https://github.com/briansunter/swipefeed 의 입력 처리 소스를 확인한다. README만으로 구현을 추측하지 않는다. 코드나 구조를 복사하면 라이선스 고지 조건을 준수하며, 필요한 개념을 현재 화면에 독립 구현하는 것을 우선한다.

## 작업
웹과 네이티브에서 동일하게 한 입력당 최대 한 작품을 이동한다. Swipefeed처럼 드래그와 휠을 구분하고 전환 중 중복 입력을 차단한다. 기본 스크롤 관성·스냅과 별도 보정이 경쟁하지 않도록 이동 주체를 하나로 만든다.

### 정확한 수정 범위
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 이 두 파일만 수정한다. 버퍼 모듈·테스트 실행기·의존성·아키텍처·다른 화면·백엔드·계획 상태를 수정하지 않는다.
- 미커밋 key 중복 수정 및 웹 플레이어 마운트 회귀 테스트를 보존한다. 자동 재생 음소거·소리 버튼·play() 정책은 이번 작업에서 변경하지 않는다.

### 공통 상태와 이동 주체
- 상태 흐름은 대기 → 드래그 또는 휠 목표 선택 → 애니메이션 → 실제 목표 위치 확인 → 재생 대상 확정 → 대기로 구성한다. 휠 관성 입력 종료 상태는 전환 완료와 별도로 관리한다.
- 화면 단위 로컬 로직으로 유지한다. 범용 라이브러리·설정 API·새 추상화 계층을 만들지 않는다.
- FlatList의 기본 사용자 스크롤·스냅·관성이 별도로 이동시키지 않게 하고 프로그램 스크롤만 사용한다. 기본 scrollEnabled를 끄고 부모 PanResponder로 터치·웹 드래그를 받아 손가락 위치를 프로그램 스크롤로 반영하는 방식을 사용한다. 웹 휠은 피드 DOM에 직접 연결한 이벤트로 처리한다.
- 이동은 같은 함수가 requestAnimationFrame으로 보간하고 FlatList.scrollToOffset({ animated: false })로 적용한다. CSS snap, pagingEnabled, snapToInterval, disableIntervalMomentum, animated: true 및 기존 사후 보정 루프를 중첩하지 않는다.
- 기본 전환 시간은 220ms로 시작한다. 화면 위치를 보간하는 애니메이션 시간과 휠 종료 판정 150ms를 별개 상수로 관리한다. 800ms 고정 cooldown은 적용하지 않는다.
- 실제 scroll offset과 요청한 offset을 구별한다. 마지막 프레임 요청만으로 activeId를 바꾸지 않고 onScroll에서 목표와 4px 이내임을 확인해 한 번만 확정한다. 이미 목표에 있는 원위치 복귀는 확인된 마지막 offset을 사용해 즉시 종료할 수 있다.
- 애니메이션 중 들어오는 늦은 이벤트가 추가 이동이나 동일 애니메이션 재시작을 만들지 않아야 한다. 완료 후 잔여 offset을 매번 되돌리는 방식으로 잠금을 구현하지 않는다.

### 드래그: 웹·네이티브
- 기존 RN PanResponder를 이용하며 손가락 또는 포인터를 따라 움직인다. 수직 이동이 10px 이상이고 수평 이동보다 클 때 넘김으로 인정한다. 단순 탭·가로 슬라이더·버튼·설정 모달 조작을 가로채지 않는다. 특히 부모 capture로 컨트롤의 responder를 빼앗지 않는다.
- 시작 시 확정 인덱스를 저장한다. 드래그 위치는 시작 인덱스의 이전·현재·다음, 첫·끝 경계 안으로 제한한다. 멀리 갔다가 되돌리지 않는다.
- 놓기 전에는 절반을 넘겨도 뒤로 끌어 돌아올 수 있다. 놓을 때 변위가 화면 높이의 절반 이상이면 해당 방향으로 한 작품, 미만이면 원위치로 결정한다. 빠른 flick을 이유로 절반 기준을 임의 변경하지 않는다.
- 놓은 뒤 목표를 고정하고 단일 220ms 애니메이션을 실행한다. 애니메이션 중 추가 드래그는 무시한다. 완료 후 새 드래그는 바로 받을 수 있다.
- 취소·responder 종료는 재생 대상이 바뀌지 않도록 원위치로 정착시킨다. 한 제스처가 취소·release 양쪽에서 처리되지 않게 한다.

### 휠·트랙패드: 웹
- 피드의 실제 DOM 노드에 wheel listener를 passive: false로 연결한다. 유효 피드 입력에서 preventDefault하여 기본 페이지 스크롤과 프로그램 이동을 중복 실행하지 않는다. 등록·해제는 같은 노드와 함수로 하고 네이티브에서는 DOM에 접근하지 않는다.
- deltaMode의 pixel·line·page를 픽셀로 정규화한다(line은 16px, page는 현재 cardHeight). 수평 우세 이벤트는 작품 이동으로 해석하지 않는다.
- 수직 delta를 누적해 100px에 도달하면 방향을 고정하고 한 작품 이동을 요청한다. 반대 방향으로 바뀌면 미확정 누적량을 초기화해 새 방향으로 누적한다. 원시 delta 부호만으로 작은 노이즈마다 이동시키지 않는다.
- 한 번 이동한 입력과 이어지는 관성은 동일 묶음으로 소비한다. 마지막 유효 wheel 이벤트 이후 150ms 조용해지면 묶음을 종료한다. 애니메이션 완료 전에는 이 타이머가 입력 잠금을 풀지 않는다.
- 이동 완료와 150ms 무입력 조건이 모두 충족된 뒤 독립적인 다음 휠 입력을 받는다. 전환 중 휠 이벤트는 새 이동을 예약하지 않는다. drag와 wheel이 동시에 별도 전환을 만들지 않는다.
- 첫·끝에서 순환하지 않으며 경계 입력 때문에 영구 잠기지 않는다. 슬라이더·버튼·설정 등의 상호작용 영역에서는 피드 휠 처리가 조작을 방해하지 않는다.

### 재생·라이프사이클 보존
- 드래그 및 애니메이션 중 확정 activeId와 기존 플레이어 재생을 유지한다. 스크롤 중이라는 이유로 pauseAll이나 자동 재생 effect 재시작을 하지 않는다.
- 목표 위치에 도착한 뒤에만 activeId를 변경하고 이전 영상 정지·처음으로 초기화, 다음 준비된 영상 재생을 수행한다. 원위치 복귀는 재생 위치·사용자 일시정지 상태를 유지한다.
- 다음 영상 로딩·실패 여부는 입력 잠금과 무관하다. 다음 독립 입력으로 건너뛸 수 있어야 한다.
- 준비 전 VideoView 마운트와 opacity로 숨김, readyToPlay 이벤트 우선 표시 갱신, 이웃 플레이어 비재생, 고유한 형제 key, 표지 대체 및 플레이어 재사용을 유지한다.
- blur·unmount 시 RAF·휠 타이머·DOM listener를 정리하고 세대로 늦은 콜백을 무효화한다. 재진입 시 마지막 확정 작품 위치로 맞추고, 화면 높이 변경 시 오래된 높이의 애니메이션을 중지해 현재 확정 작품의 새 위치로 정렬한다. 정렬은 작품 넘김이나 새 입력으로 처리하지 않는다.

### 주요 로직 코드 또는 변경 예시
다음 흐름을 화면에 통합한다. 웹 wheel과 PanResponder release가 같은 animateToPage를 호출한다. DOM 이벤트 정규화·타이머·listener는 위 요구에 맞게 연결한다. readActualOffset은 onScroll이 기록한 값이며 setRequestedOffset과 분리한다. commitPage는 실제 도착 후에만 기존 버퍼 재생 전환을 수행하는 함수다.

```tsx
type PageMotion = {
  from: number;
  target: number;
  generation: number;
  framesDone: boolean;
};
const TRANSITION_MS = 220;
const WHEEL_QUIET_MS = 150;
const clampIndex = (index: number) => Math.max(0, Math.min(dramasRef.current.length - 1, index));
const releaseTarget = (startIndex: number, displacement: number, height: number) =>
  clampIndex(startIndex + (Math.abs(displacement) >= height / 2 ? Math.sign(displacement) : 0));

const animateToPage = (target: number) => {
  if (motionRef.current) return;
  const generation = generationRef.current;
  const motion: PageMotion = { from: actualOffsetRef.current, target, generation, framesDone: false };
  motionRef.current = motion;
  const start = performance.now();
  const frame = (now: number) => {
    if (!focusedRef.current || generationRef.current !== generation || motionRef.current !== motion) return;
    const progress = Math.min(1, (now - start) / TRANSITION_MS);
    const eased = 1 - Math.pow(1 - progress, 3);
    const targetOffset = target * cardHeightRef.current;
    motion.framesDone = progress === 1;
    listRef.current?.scrollToOffset({ offset: motion.from + (targetOffset - motion.from) * eased, animated: false });
    if (!motion.framesDone) frameRef.current = requestAnimationFrame(frame);
    else finishIfArrived();
  };
  frameRef.current = requestAnimationFrame(frame);
};

const finishIfArrived = () => {
  const motion = motionRef.current;
  if (!motion?.framesDone || Math.abs(actualOffsetRef.current - motion.target * cardHeightRef.current) > 4) return;
  motionRef.current = null;
  commitPage(motion.target);
  // 휠 입력 묶음은 마지막 wheel 이벤트 뒤 150ms 조용해질 때까지 별도로 유지한다.
};

const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  actualOffsetRef.current = event.nativeEvent.contentOffset.y;
  finishIfArrived();
};

const handleWheel = (event: WheelEvent) => {
  if (isInteractiveTarget(event.target) || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return;
  event.preventDefault();
  if (dragRef.current) return;
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? cardHeightRef.current : 1;
  const delta = event.deltaY * scale;
  const wheel = wheelRef.current;
  wheel.quiet = false;
  clearTimeout(wheelTimerRef.current);
  wheelTimerRef.current = setTimeout(() => {
    wheel.quiet = true;
    if (!motionRef.current) {
      wheel.consumed = false;
      wheel.accumulated = 0;
    }
  }, WHEEL_QUIET_MS);
  if (motionRef.current || wheel.consumed) {
    wheel.consumed = true;
    return;
  }
  wheel.accumulated = Math.sign(wheel.accumulated) === Math.sign(delta) ? wheel.accumulated + delta : delta;
  if (Math.abs(wheel.accumulated) < 100) return;
  wheel.consumed = true;
  const next = clampIndex(committedIndexRef.current + Math.sign(wheel.accumulated));
  if (next !== committedIndexRef.current) animateToPage(next);
};
```

- 예시의 motion 관리와 기존 코드의 명명·타입은 통합 시 조정한다. 이벤트에서는 최신 값을 읽는 ref 등으로 함수를 안전하게 호출하며 오래된 closure가 재생 대상을 변경하지 않게 한다.
- RAF의 최종 요청이 동일 offset이라 onScroll이 발생하지 않는 경우에도 이미 확인된 actualOffset으로 finishIfArrived를 호출할 수 있게 한다. 고정 시간 경과만으로 미도착 작품을 재생하지 않는다.
- commitPage 후 휠이 이미 quiet이면 consumed와 accumulated를 초기화한다. 반대로 아직 quiet가 아니면 타이머까지 유지한다. 예시의 wheel 타이머에도 세대·포커스 검사를 적용하고 blur 시 취소한다. isInteractiveTarget은 웹 DOM target뿐 아니라 기존 RN 컨트롤의 responder 소유권을 보존하는 입력 제외 처리와 함께 구현한다.

### 회귀 테스트와 완료 조건
- 기존 화면 하네스에 PanResponder·RAF 시각·wheel DOM 등록/해제의 최소 mock을 추가한다. 소스 문자열 일치나 props 존재만 확인하지 말고 입력 → 위치 요청 → 실제 offset 통지 → 재생 상태를 검증한다.
- RAF를 가상 시계로 진행하고 마지막 요청 후에도 실제 offset 통지가 올 때까지 activeId와 현재 재생이 변하지 않는지 검증한다.
- 웹의 pixel/line/page wheel, 100px 미만 노이즈, 방향 변경, 긴 트랙패드 관성, 150ms 경과와 애니메이션 완료의 순서 양쪽을 검증한다. 한 묶음은 한 작품만 이동하며 독립적인 다음 입력은 긴 고정 대기 없이 한 작품 더 이동해야 한다.
- iOS/Android에 해당하는 PanResponder 이벤트로 느린 드래그, 절반 미만 복귀, 정확히 절반, 절반을 넘긴 뒤 손을 떼지 않고 역방향 복귀, 긴 드래그, 취소를 검증한다.
- 앞뒤 양방향, 4작품 이상, 첫·끝 비순환과 잠금 해제, 애니메이션 중 연타·다른 drag/wheel 무시, 완료 후 새 입력을 검증한다.
- 한 번의 이동에 시작된 보간은 하나뿐이며 도착 후 보정 scrollToOffset이나 새 애니메이션이 추가되지 않는지 검증한다. 네이티브 기본 snap/CSS snap이 비활성 상태인지도 확인한다.
- 버튼·슬라이더·설정 모달 조작이 작품 이동으로 처리되지 않는지 확인한다. 테스트에서도 상호작용 영역 입력 제외 경로를 검증한다.
- 원래 작품 복귀 시 시간·pause 유지, 다음 페이지 도착 후 reset/재생, loading/failed 건너뛰기, idle부터 View 마운트를 통한 준비, 준비된 카드 표지 생략, 이웃 비재생, key 유일성, blur 해제의 기존 검증을 보존한다.
- blur/재진입/높이 변경과 오래된 RAF·타이머가 겹쳐도 불필요한 이동·재생이 생기지 않는지 검증한다.
- 기존 입력 처리를 대체해 불필요해진 ref·타이머·handler·props만 제거하고 두 개의 이동 경로를 남기지 않는다.

### 검증 명령
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 기존 `http://localhost:8081`의 현재 코드 반영을 확인하고 웹의 휠·트랙패드·포인터/터치 drag, 마지막 잔움직임, 느린 drag 중 재생과 도착 후 재생을 실제 화면에서 확인한다. 실제 브라우저 검증을 수행할 수 없으면 미검증으로 명시한다.
- 사용 가능한 iOS·Android 실기기/에뮬레이터에서 drag·cancel·slider 충돌을 확인한다. 환경이 없으면 미검증으로 명시하고 export 성공을 실기기 검증으로 표현하지 않는다.
- 8081이 미실행이면 화면 검증 실패로 기록하고 `npm --prefix front run start -- --port 8081`을 안내한다. 서버를 자동 실행하거나 다른 포트로 변경하지 않는다.
