# task-1-dialog-dismissal

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-28-episode-dialog-dismissal/plan.md`
- `front/src/components/EpisodeUnlockDialog.tsx`
- `front/src/components/ui.tsx`
- `front/src/features/economy/episodePurchase.ts`
- `front/src/features/user/UserProvider.tsx`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/playbackScreen_preview.tsx`
- `front/src/screens/playbackScreen_episode.tsx`
- `front/scripts/test-front.cjs`
- `front/tests/unit/episodePurchase.test.ts`
- `front/node_modules/react-native/Libraries/Modal/Modal.d.ts`
- `front/node_modules/react-native-web/dist/exports/Modal/ModalAnimation.js`
- Expo 57: https://docs.expo.dev/versions/v57.0.0/
- React Native Animated: https://reactnative.dev/docs/0.86/animated
- React Native Modal: https://reactnative.dev/docs/0.86/modal

## 작업

다음 세 파일만 수정한다. 다른 작업자의 변경을 되돌리지 말고 현재 코드에 맞춘다. apply_patch로 수정한다. plan 상태·Git·web-prototype은 수정하지 않는다.

- `front/src/components/EpisodeUnlockDialog.tsx`
- `front/tests/unit/episodeUnlockDialog.test.ts`
- `front/scripts/test-front.cjs`

팝업 내부에서 열림·닫힘 중·숨김 상태를 구분한다. 일반 닫기와 구매 성공 모두 닫힘 시작 시 현재 화면의 표시값(작품명, 회차, 가격, 잔액, 안내, 버튼 문구, 오류)을 보존한다. 이후 episode null, Context 잔액 갱신, purchasing 초기화가 진행돼도 애니메이션 중 표시값은 바뀌지 않아야 한다. 표시용 값을 구매 허용 조건이나 API 대상에 재사용하지 않는다.

부모 onClose를 먼저 호출해서 episode를 지우는 대신, 공통 팝업이 fade를 마친 뒤 닫힘을 알린다. Modal의 내장 fade를 none으로 바꾸고 내부 Animated.View로 배경과 본문 전체 opacity를 함께 제어해 모든 플랫폼에서 완료를 확인한다. 열림 fade도 유지한다. onShow를 활용해 실제로 보인 뒤 열림 애니메이션을 시작한다. native driver는 native 플랫폼에서 사용하고 web에서는 호환 설정을 사용한다. 새 애니메이션 패키지를 추가하지 않는다.

닫힘은 실제 animation callback의 finished가 true일 때만 완료한다. 중단된 이전 애니메이션 또는 컴포넌트 해제로 성공 콜백이 실행되지 않게 한다. 닫힘 요청을 동기 ref로 한 번만 받아 두 닫기 버튼, onRequestClose, 구매 및 충전의 중복 조작을 막는다. 구매 중 닫기 차단과 구매 API 중복 방지는 유지한다.

구매 성공 시 닫힘 표시값을 먼저 확보하고 서버 availablePoints로 Context를 갱신한다. onPurchased는 fade 완료 및 Modal 숨김 반영 후 한 번만 호출한다. iOS는 native Modal의 onDismiss에서 완료를 확정한다. web도 제공되는 onDismiss를 활용할 수 있다. Android는 onDismiss 지원을 전제로 하지 않고 내부 fade 완료 후 visible=false가 커밋된 단계에서 확정한다. 일반 닫기에는 구매 성공 콜백을 저장하지 않는다. 충전 버튼 역시 닫힘 뒤 기존 onCharge를 호출해 화면 이동이 닫힘과 겹치지 않게 하되 호출 화면의 기존 구현은 수정하지 않는다. 구매 실패 시 팝업을 유지하고 이전 오류 정책을 그대로 따른다.

### 주요 로직 코드 또는 변경 예시

아래는 실행 순서의 핵심 예시다. 상태 선언, 렌더, 애니메이션 열림/정리, 플랫폼별 숨김 확인, 재오픈 처리는 같은 컴포넌트에서 완성한다. pending action은 실행 전에 제거해 중복 완료 이벤트를 막는다.

```tsx
type CloseAction = { kind: 'dismiss' }
  | { kind: 'purchase'; episode: Episode }
  | { kind: 'charge' };

const beginClose = (action: CloseAction) => {
  if (closing.current) return;
  closing.current = true;
  pendingAction.current = action;
  setClosingDisplay(currentDisplay);
  setClosing(true);
  opacity.stopAnimation();
  closeAnimation.current = Animated.timing(opacity, {
    toValue: 0,
    duration: 200,
    useNativeDriver: Platform.OS !== 'web',
  });
  closeAnimation.current.start(({ finished }) => {
    if (!finished || !mounted.current) return;
    setModalVisible(false);
    setAwaitingDismiss(true);
  });
};

const completeDismiss = () => {
  if (!mounted.current || !pendingAction.current) return;
  const action = pendingAction.current;
  pendingAction.current = null;
  onClose();
  if (action.kind === 'purchase') onPurchased(action.episode);
  if (action.kind === 'charge') onCharge();
};

// Modal.onDismiss invokes completeDismiss on iOS/web.
// Android completes in an effect after the invisible Modal was committed.
useEffect(() => {
  if (Platform.OS === 'android' && awaitingDismiss && !modalVisible) {
    completeDismiss();
  }
}, [awaitingDismiss, modalVisible]);

// In the API-success branch, outside its purchase-failure catch:
beginClose({ kind: 'purchase', episode: selectedEpisode });
setPoints(result.availablePoints);
```

currentDisplay는 표시용 값이며 기존 한국어 UI 문구를 유지한다. 닫힘 시작 시 구매 버튼 문구도 포함해 purchasing의 finally 갱신으로 닫히는 도중 문구가 바뀌지 않게 한다. 성공 분기에서는 purchasing 해제보다 먼저 표시값을 확보해야 한다. 실패 분기의 finally에서 요청 상태를 해제하는 동작은 유지한다.

오류 초기화는 다음 표시 세션에 적용한다. 재오픈 시 최신 회차·포인트·구매 가능 여부를 표시하고 이전 pending action과 closing 상태를 재사용하지 않는다. 외부 episode=null 변경도 이동 콜백 없는 닫힘으로 처리하며 표시값을 유지한 채 종료한다.

회귀 테스트는 새 의존성 없이 기존 Node test runner에서 실행한다. 예를 들어 TypeScript transpileModule과 node:vm으로 실제 TSX 모듈을 로드하고 React hooks/JSX 및 React Native 경계를 테스트에서 대체해 렌더와 effect 커밋을 구동할 수 있다. require 대체는 해당 vm에 한정하고 전역 모듈 로더를 변경하지 않는다. Animation.start 완료 콜백은 테스트가 명시적으로 호출해 완료 전후를 검증한다. 테스트 도우미는 해당 test 파일 내부에만 두고 범용 테스트 프레임워크로 확장하지 않는다. DOM·기기 렌더 검증을 대체했다고 주장하지 않는다.

필수 회귀 시나리오:

1. 구매 가능 상태에서 두 닫기 버튼/onRequestClose를 각각 실행: fade 동안 기존 버튼·안내·회차·가격·잔액이 유지되고 구매 콜백은 실행되지 않는다.
2. 구매 성공: availablePoints 갱신에도 표시 보존, fade 완료 전 onPurchased=0, 완료 및 숨김 커밋 이후 올바른 episode로 한 번 실행된다.
3. 중복 닫기/구매 및 중복 완료 이벤트가 추가 API 요청·콜백을 만들지 않는다.
4. finished=false 또는 unmount 후 늦은 완료 이벤트는 이동하지 않는다.
5. 실패 응답은 닫지 않고 오류를 유지하며 재시도 가능하다. 오류가 보이는 상태에서 닫는 동안 문구가 사라지지 않는다.
6. 재오픈은 최신 포인트·회차·버튼 상태를 표시하고 이전 성공 콜백을 실행하지 않는다.
7. iOS/web onDismiss와 Android hidden commit 경로를 구분해 조기 콜백을 막는다. 충전도 닫힘 완료 후 기존 콜백을 실행한다.

test-front.cjs의 기본 testFiles 배열에 새 테스트만 등록한다. 기존 다른 테스트 목록이나 의존성은 변경하지 않는다.

검증 명령:

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

완료 조건:

- 위 세 checks가 통과하고 새 테스트가 실제 기본 실행 목록에서 실행된다.
- 표시 유지와 완료 후 이동 순서를 회귀 테스트로 확인한다. 호출 화면과 구매 HTTP 계약은 변경하지 않는다.
- plan.md의 실제 화면 검증을 수행하고 결과와 미검증 사유를 정확히 보고한다. 서버가 없으면 실패와 시작 명령을 보고한다. 브라우저/기기 도구가 없으면 UI·native dismissal·실제 재생을 통과로 표시하지 않는다.
