# task-3-retain-control-touch-target

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `_docs/plans/plan-40-recommendation-swipe-input/plan.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 구현 전 Expo 57 공식 문서 및 설치된 RN/RNW의 PanResponder·PressResponder와 DOM touch 이벤트 대상 생명주기를 확인한다.

## 작업
컨트롤이 보이는 상태에서도 첫 터치 드래그로 작품을 넘길 수 있게 한다. 공통 화면에서 컨트롤을 조건부 제거하는 것과 시각적으로 숨기는 것을 분리한다. 재생바만 제외한 전체 피드 드래그 정책을 유지한다.

### 정확한 수정 범위
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 위 두 파일만 수정한다. 웹·iOS·Android 공통 화면에 적용한다.
- 220ms 단일 이동, 150ms 휠 묶음, 반 페이지 기준, 한 작품 제한, 부모 capture, 실제 도착 후 재생, 재생바 제외, 드래그 후 click 취소, 버퍼·VideoView·고유 key는 유지한다.
- 별도 라이브러리·백엔드·의존성·테스트 실행기·다른 화면·자동 재생 소리 정책은 수정하지 않는다.

### 확인된 원인과 재현
- 현재 renderItem의 showControls는 `showVideo && !scrolling && ...`이며 이 값이 false이면 RecommendationPreviewPlayer 자체가 언마운트된다.
- 드래그 grant가 setScrolling(true)를 호출하면 처음 터치한 배경 Pressable/버튼의 DOM 노드도 제거된다.
- 실제 Chrome에 CDP Input.dispatchTouchEvent로 입력했을 때 parent capture=true, grant 및 첫 move까지만 기록되고 이어지는 move/end는 문서까지 도달하지 않았다. 컨트롤은 사라지고 페이지는 이동하지 않았다.
- 같은 세션의 두 번째 터치는 컨트롤이 없어 터치 대상이 유지됐고 마지막 release와 한 페이지 이동이 확인됐다. 단순 클릭으로 컨트롤 숨김 핸들러가 실행된 것이 아니었다.
- 기존 하네스는 DOM 노드 삭제 후에도 callback을 직접 호출해 실제 이벤트 단절을 놓쳤다. 단순 함수 호출 테스트만으로 이 결함의 해결을 보고하지 않는다.

### 구현 지시
- 컨트롤 마운트 조건에서 scrolling을 제거한다. 현재 준비된 작품의 컨트롤 컴포넌트와 key는 같은 제스처 도중 유지한다.
- 이동 중 컨트롤을 숨길 때는 안정된 같은 wrapper의 opacity 등 가시성만 변경한다. 조건부 JSX 제거, key 변경, display:none, 터치 중 재부착으로 터치 대상을 교체하지 않는다.
- 원래 터치 대상뿐 아니라 그 조상 DOM/네이티브 요소도 제스처 종료 전에 제거하지 않는다. 활성 터치 중 pointerEvents 변경으로 네이티브 responder를 끊는 방식도 피한다. 탭 취소·전환 중 입력 잠금은 기존 제스처 흐름이 담당한다.
- RecommendationPreviewPlayer 내부의 controlsVisible 분기도 확인한다. 부모만 유지해도 내부 버튼이 자동 숨김 타이머로 제거되면 같은 문제가 반복된다. 터치 시작부터 release/cancel까지, 특히 10px 드래그 판정 전 손을 누르고 있는 동안에도 해당 터치 대상은 유지한다.
- 터치가 유지되는 동안 컨트롤 자동 숨김을 보류하거나 동일 자식 트리를 유지한 채 가시성만 바꾸는 최소 변경을 선택한다. 숨김 타이머·컨트롤 상태 변경이 터치 노드를 제거하지 않아야 한다.
- 원위치 복귀 후 컨트롤 표시와 사용자 pause·재생 위치를 보존한다. 컴포넌트가 유지되므로 timeUpdate 등 listener와 제어 상태가 정상 갱신돼야 하며, 자동 재생 effect를 불필요하게 다시 실행하지 않는다.
- 목표 위치에 정착해 다음 작품으로 확정된 뒤 기존 작품의 컨트롤을 해제하는 것은 허용한다. 이 시점은 원래 터치 release/cancel을 받은 이후여야 한다. blur/unmount에서는 기존 정지·해제·입력 초기화를 보존한다.

### 주요 로직 코드 또는 변경 예시
마운트 여부와 이동 중 가시성을 분리한다. 아래는 renderItem과 컨트롤 wrapper의 핵심 예시다. 기존 props를 유지하며 내부 controlsVisible/자동 숨김에도 같은 원칙을 적용한다.

```tsx
const mountControls = showVideo && activeId === drama.uuid && activePlayer === player;

{mountControls && activeDramaForPreview && activePreviewTarget ? <RecommendationPreviewPlayer
  key={`controls:${recommendationPreviewKey(activePreviewTarget)}`}
  player={activePlayer!}
  moving={scrolling}
  // 기존 drama/content/listener/action/seek props는 동일하게 연결한다.
/> : null}

// RecommendationPreviewPlayer 안에서: 같은 wrapper와 자식 노드를 유지한다.
return <View style={[StyleSheet.absoluteFill, { opacity: moving ? 0 : 1 }]}>
  {controlTree}
</View>;
```

- `controlTree`는 기존 컨트롤 JSX를 뜻한다. 예시 이름의 새 추상화를 만들 필요는 없다. 전체 화면 배치와 실제 버튼·재생바 위치를 기존과 동일하게 유지한다.
- moving 변경에 따라 useEffect에서 플레이어 재생/정지를 수행하지 않는다. 가시성과 터치 대상 유지에만 사용한다.
- 터치 종료 전 내부 컨트롤 제거도 방지해야 한다. controlsVisible을 가시성에만 적용하거나, 터치 활성 상태에서 숨김 타이머를 보류하는 방식으로 구체화하고 테스트한다.

### 회귀 테스트와 완료 조건
- 컨트롤이 보이는 상태에서 배경 Pressable과 실제 버튼을 각각 터치 시작 → parent capture/grant → move 여러 번 → release하는 첫 제스처로 한 작품 이동해야 한다. 먼저 컨트롤을 닫는 탭을 요구하지 않는다.
- 드래그 중 RecommendationPreviewPlayer의 key와 터치 시작한 자식 노드의 정체성이 유지되는지 검증한다. 하네스는 조건부 렌더 결과도 다시 평가해 대상을 잃으면 이후 이벤트를 보내지 않도록 한다. 단순히 오래된 callback을 계속 호출하는 검증은 충분하지 않다.
- 터치를 누른 채 4초 자동 숨김 시점이 지나거나, 드래그 중 타이머가 발생해도 move/release를 잃지 않아야 한다.
- 원위치 복귀, 두 번째 독립 제스처, 전환 중 중복 입력 방지, 새 작품 도착 후 컨트롤 교체를 확인한다.
- 재생바에서 시작한 터치는 여전히 작품 이동 0회, 가로 seek 및 완료/취소 후 일반 드래그 복구가 정상이어야 한다.
- 일반 버튼의 단순 탭은 1회 실행, 버튼에서 시작한 드래그는 해당 버튼 부작용 0회, 다음 독립 탭은 정상 실행을 유지한다.
- 컨트롤 유지로 이웃 영상이 재생되거나 원위치 복귀 시 pause가 풀리지 않게 기존 재생·listener·blur·버퍼·key 검증을 보존한다.

### 검증 명령과 실제 웹 확인
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 기존 localhost:8081에서 실제 터치 입력을 검증한다. 마우스 입력만으로 대체하지 않는다. 로컬 Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`와 CDP를 통한 headless 터치 재현이 가능함을 분석 단계에서 확인했다. 모의 DOM callback/HTTP 200/export를 실제 터치 검증으로 보고하지 않는다.
- 컨트롤 표시 상태 → 첫 손가락 드래그로 전환, move/end 연속 수신, 터치 대상이 유지됨, 한 페이지 이동을 확인한다. 버튼 위 시작·재생바 제외·늦은 click 취소도 함께 확인한다. 브라우저 테스트를 자동화할 경우 기존 승인된 테스트 파일 안에 추가할 수 있으며 새 의존성·별도 제품 테스트 파일은 만들지 않는다.
- Chrome 실행은 별도 임시 프로필과 숨겨진 창으로 수행하고 분석 종료 후 해당 브라우저만 종료한다. 사용자의 기존 브라우저 세션을 조작하거나 전체 브라우저 프로세스를 종료하지 않는다.
- 앱 공통 코드를 수정한 뒤 사용 가능한 iOS/Android 기기에서 같은 입력을 확인한다. 환경이 없으면 네이티브 조작은 미검증으로 명시한다.
- 서버가 미실행이면 실제 화면 검증 실패로 기록하고 `npm --prefix front run start -- --port 8081`을 안내한다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. 환경 제한을 제품 검증 통과로 기록하지 않는다.
