# task-4-fast-swipe

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `_docs/plans/plan-40-recommendation-swipe-input/plan.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 구현 전 Expo 57 공식 문서, 해당 RN/RNW PanResponder의 dy·vy 단위 및 release 시 gestureState 전달을 확인한다.

## 작업
웹·iOS·Android 공통 화면의 손가락/포인터 release 판정에 빠른 스와이프 조건을 추가한다. 느리게 끌 때는 기존 절반 거리 규칙을 유지하고, 짧게 쓸어 놓으면 최근 이동 속도와 최소 이동 거리를 충족할 때 한 작품 이동한다.

### 정확한 수정 범위
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 위 두 파일만 수정한다. use-gesture 및 새 의존성·설정 UI·별도 추상화·다른 화면·백엔드를 추가하지 않는다.
- 220ms 이동 애니메이션, 150ms 휠 종료 판정, 휠 누적 기준 100px, 한 작품 제한, 실제 도착 후 재생, 재생바만 제외하는 입력 정책과 터치 대상 유지 수정은 보존한다.
- 이 task는 손을 놓을 때 목표를 선택하는 기준을 변경한다. 손을 잡고 있는 동안에는 기존처럼 화면이 손을 따라 움직인다. 절반이나 속도 조건을 넘겼다는 이유만으로 손을 놓기 전에 자동 전환하지 않는다.

### 판정 기준
- 기존 거리 기준: 손을 놓을 때 `abs(dy) >= cardHeight / 2`이면 해당 방향으로 한 작품 이동한다. 느린 드래그 기준을 20~25% 등으로 낮추지 않는다.
- 추가 빠른 스와이프 기준: `abs(dy) >= 50`, 최근 수직 속도 `abs(vy) >= 0.5`, 마지막 move부터 release까지 100ms 이내, 최근 이동 방향과 최종 dy 방향이 같으면 한 작품 이동한다.
- 거리 기준 또는 빠른 스와이프 기준 중 하나를 충족하면 이동하며, 모두 미충족이면 원위치 복귀한다. 첫·끝에서는 현재 인덱스로 제한하고 순환하지 않는다.
- 50px는 화면 좌표의 레이아웃 단위다. 웹 CSS px와 RN 좌표 단위를 사용하고 기기 물리 픽셀로 변환하지 않는다. 속도 단위는 같은 좌표 단위/ms다.
- 초기값 50px·0.5px/ms·100ms는 우리 화면의 명시적인 테스트 설정이며 유튜브의 공식 수치로 표현하지 않는다. 전체 제스처를 250ms 이하로 제한하지 않는다. 잠시 누른 뒤 빠르게 쓸어 놓는 입력도 허용한다.
- 전체 제스처의 평균 속도가 아니라 마지막 move의 속도를 기록한다. release에서 마지막 move의 시간·속도를 함께 확인하여 예전에 빨랐지만 이후 멈춘 손을 빠른 스와이프로 오인하지 않는다. NaN/Infinity 등 유효하지 않은 속도는 빠른 조건을 충족하지 않은 것으로 처리한다.
- 되돌리는 동작을 구분한다. 절반 미만 위치에서 마지막 움직임이 처음과 반대 방향이면, 과거의 빠른 속도로 이전 목표를 확정하지 않는다. 속도 방향과 release dy 방향이 일치할 때만 빠른 조건을 허용한다.
- 기존 수직 우세·10px 제스처 시작 조건을 유지한다. 재생바·취소·전환 중 추가 입력은 빠른 속도여도 넘기지 않는다. terminate는 원위치 복귀이며 속도 판정을 실행하지 않는다.

### 주요 로직 코드 또는 변경 예시
기존 gestureRef에 lastMoveAt, lastVelocityY를 추가한다. grant에서 새로 초기화하고 move에서 기록한 다음 release에서 한 번만 목표를 선택한다. 아래 예시는 현재 함수에 통합하며 기존 setRequestedOffset 및 animateToPage를 그대로 사용한다.

```tsx
const FAST_SWIPE_MIN_DISTANCE = 50;
const FAST_SWIPE_MIN_VELOCITY = 0.5;
const FAST_SWIPE_FRESH_MS = 100;

// grant에서 생성하는 기존 제스처에 추가
lastMoveAt: null as number | null,
lastVelocityY: 0,

// move에서 기존 유효 제스처 검사 후 기록
current.lastMoveAt = performance.now();
current.lastVelocityY = Number.isFinite(gesture.vy) ? gesture.vy : 0;

// release에서 기존 active/handled 검사 후 한 번만 실행
const distance = Math.abs(gesture.dy);
const age = current.lastMoveAt === null ? Infinity : performance.now() - current.lastMoveAt;
const quickSwipe = distance >= FAST_SWIPE_MIN_DISTANCE
  && age >= 0 && age <= FAST_SWIPE_FRESH_MS
  && Math.abs(current.lastVelocityY) >= FAST_SWIPE_MIN_VELOCITY
  && Math.sign(current.lastVelocityY) === Math.sign(gesture.dy);
const shouldAdvance = distance >= cardHeightRef.current / 2 || quickSwipe;
const target = shouldAdvance
  ? current.startIndex + (gesture.dy < 0 ? 1 : -1)
  : current.startIndex;
current.handled = true;
current.active = false;
animateToPage(target);
```

- lastMoveAt은 제스처를 실제로 받은 move에서만 갱신한다. release나 타이머에서 새 시각으로 덮어써 오래된 속도를 신선하게 만들지 않는다.
- grant·cancel·blur·높이 변경·새 제스처에서 이전 속도를 재사용하지 않는다. 별도 이동 애니메이션이나 지연 실행을 추가하지 않는다.
- 실제 RN/RNW가 제공하는 vy가 최근 속도 의미에 맞는지 확인하고 실제 브라우저에서 검증한다. 필요한 최소 로컬 보정이 있으면 동일한 기준과 단위를 유지하고 테스트로 명확히 한다.

### 회귀 테스트와 완료 조건
- 가상 시계를 사용해 시각·dy·vy를 명시한다. 기존 하네스의 속도 생략 이벤트는 0으로 처리해 기존 느린 드래그 검증을 유지한다.
- 위/아래 각각 절반 미만 60~100px의 빠른 움직임 뒤 즉시 release는 정확히 한 작품 이동한다. 손을 잡고 있는 move 단계에서는 아직 activeId나 이웃 재생이 바뀌지 않아야 한다.
- 같은 거리라도 느린 움직임은 복귀한다. 최소 거리 50px 미만이면 빠르더라도 복귀하고, 50px·0.5px/ms 및 100ms의 경계값을 검증한다.
- 빠르게 움직인 뒤 100ms를 초과해 멈추고 놓으면, 절반 미만에서는 복귀한다. 긴 홀드 뒤 최근에 빠르게 쓸어 놓는 경우는 정상 이동한다.
- 이동을 되돌려 최종 dy와 최근 속도 방향이 다른 경우 과거 방향으로 넘어가지 않는다. 이동 없음·유효하지 않은 속도·수평 우세·취소는 잘못된 빠른 이동을 만들지 않는다.
- 느린 절반 이상 드래그, 절반 미만 원위치 복귀의 사용자 pause/재생 위치, 첫·끝 비순환, 전환 중 중복 방지, 다음 독립 입력을 보존한다.
- 컨트롤이 보이는 상태에서 첫 빠른 스와이프가 끝까지 이어지고, 컨트롤 터치 대상이 release 전에 제거되지 않는지 보존한다. 버튼 동작 오발사·클릭 억제·다음 정상 탭도 확인한다.
- 재생바에서 시작한 빠른 수직 입력은 작품을 넘기지 않으며 가로 seek는 정상 동작한다. 휠·트랙패드는 기존 경로로 처리되고 손가락의 vy 판정을 적용하지 않는다.
- 기존 요청 offset/실제 offset 구분을 유지한다. 빠른 스와이프도 목표 위치에 실제 도착한 뒤에만 이전 영상 reset 및 다음 재생을 수행한다.

### 검증 명령과 실제 조작
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 기존 `http://localhost:8081/recommend`에서 실제 Chrome/CDP 터치로 느린 짧은 드래그 복귀와 빠른 짧은 스와이프 이동을 같은 거리에서 비교한다. 속도가 다른 두 입력을 테스트하면서 dy·시각·도착 작품을 확인하고 단순 callback 직접 호출만으로 실제 스와이프 검증을 대신하지 않는다.
- 컨트롤 표시 중 버튼 위 스와이프, 재생바 제외 및 1회 이동을 확인한다. 네이티브 기기/에뮬레이터가 있으면 동일하게 검증하고 없으면 네이티브 실조작은 미검증으로 명시한다.
- 기존 8081 서버만 사용한다. 서버가 없으면 실제 화면 검증 실패와 `npm --prefix front run start -- --port 8081` 안내를 기록한다. 자동 서버 실행·다른 포트 우회는 하지 않는다.
