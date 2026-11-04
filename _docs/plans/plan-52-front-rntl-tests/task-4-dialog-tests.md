# task-4-dialog-tests

## 기본 입력

- 이 task 문서와 index.json의 task-4 항목.
- 컨텍스트로 전달된 루트·front 적용 지침 및 선행 task 완료 요약. 다른 작업자가 함께 작업하므로 다른 task의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- front/tests/unit/episodeUnlockDialog.test.ts와 sessionExpiredDialog.test.ts의 기존 테스트 이름·fixture·플랫폼 완료 시나리오.
- front/src/components/EpisodeUnlockDialog.tsx의 props·purchase/beginClose/completeDismiss/onShow·Modal 이벤트·세션 무효화 구간.
- front/src/components/SessionExpiredDialog.tsx 전체 및 front/src/app/_layout.tsx의 루트 팝업·로그인 경로 연결.
- front/src/components/ui.tsx의 Button/EmptyState와 front/src/features/user/UserProvider.tsx의 useUser 계약, economy/episodePurchase.ts의 반환 계약.
- task-1의 setup/mock 정리 규칙 및 설치된 RNTL 13 render/fireEvent/userEvent와 expo-router/testing-library의 renderRouter API.

## 필요 시 참고할 문서

- 전달된 적용 지침이 누락되었거나 변경되었을 때만 AGENTS.md와 front/AGENTS.md의 테스트·셸 규칙을 확인한다.
- 테스트/제품 책임 경계 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend와 Boundaries를 확인한다.
- 이 문서의 승인 계약이 누락되거나 충돌할 때만 plan.md의 승인된 계약 및 기능별 검증 대응을 확인한다. 전체 plan 재독은 필요하지 않다.

## 실패 시 참고할 파일

- task-7이 전달한 실패에 한해 해당 팝업의 이벤트 처리와 구매 API fixture를 확인한다. 전역 React mock이나 자체 commit 루프를 추가하지 않는다.

## 작업

구매·세션 만료 팝업과 실제 루트 배치를 RNTL로 렌더링하여 닫힘·구매·이동 계약을 보존한다.

### 보존 시나리오

- 닫히는 동안 표시 문구/회차/금액이 고정되고 disabled 상태이며 dismiss는 구매하지 않는다.
- 구매 API는 연속 탭에도 한 번만 호출된다. 성공 후 포인트는 반영되지만 onPurchased는 fade 완료와 플랫폼 dismiss 확인 뒤 한 번만 호출된다.
- iOS의 onDismiss와 Android의 hidden commit/후속 effect를 구분한다. 중단된 애니메이션 finished:false는 완료 처리하지 않는다. Android 경로에서 onDismiss 이벤트를 인위적으로 호출해 대신하지 않는다.
- 구매 실패 문구는 닫히는 동안 유지되고 다음 열림에는 새 회차 상태를 사용한다. 충전/익명 로그인 분기는 구매 API를 호출하지 않으며 기존 콜백 순서를 유지한다.
- API 대기 또는 닫힘 애니메이션 중 sessionVersion 변경은 이전 구매/이동을 취소하고 새 세션 동작을 허용한다. 루트 만료 안내가 처리하는 401을 구매 오류로 중복 표시하지 않는다.
- 루트의 만료 안내는 한 곳에서 표시되고 닫기/시스템 닫기는 dismiss만, 로그인 버튼은 dismiss 후 /login으로 이동한다. visible:false면 사용자에게 만료 문구가 노출되지 않는다. 기존의 가짜 트리에 invisible Modal 객체 한 개가 있었다는 검사는 사용자 숨김 및 필요한 Modal prop 관찰로 대응한다.

### 구현 지시

- 버튼은 실제 Button/Pressable을 렌더링하고 role/name으로 찾는다. 실제 React effect와 state를 사용한다.
- 단독 팝업은 render, 루트 팝업/라우팅은 실제 RootLayout을 메모리 renderRouter의 _layout에 연결한다. Stack이 선언한 route는 최소 fixture route로 공급하고 폰트/세션/API 입력만 mock한다.
- Animated.timing은 native animation 경계로만 제어한다. start callback을 완료/중단 결과로 전달하는 한정 spy와 Jest fake timer를 사용한다. Modal은 native onShow/onDismiss/onRequestClose에 한해 fireEvent와 필요한 제한된 타입 query를 허용하고 그 이유를 적는다. React commit/effect를 직접 구현하지 않는다.
- deferred 구매 Promise의 resolve/reject는 await act로 진행하고, fade 전·fade 후·dismiss 후의 콜백 횟수를 각각 확인한다. 모킹한 Animated/Platform과 타이머는 테스트마다 복원한다.

### 역할과 완료 조건

테스트 작성 역할이다. 제품 src와 공통 실행기/setup/helper는 수정하지 않는다. 원본 최상위·하위 시나리오 전부를 이전 테스트와 대응시키고 완료 요약에 기존/새 이름과 관찰 방식 변경 사유를 적는다. 원본 .test.ts 삭제와 새 .test.tsx 작성을 모두 이 task가 담당한다. 가짜 렌더러에 묶인 내부 구조 관찰을 공개 결과·명시적인 native 경계 관찰로 바꾸되 의미·경계값·실패 조건을 약화하지 않는다. 작성 완료는 기능 통과가 아니다. 실제 선택·전체 검증은 task-7이 수행한다. 통합 시 결함이 보고되면 해당 작성 task의 파일 범위에서 수정한다. 공유 지원 API의 결함은 task-1 소유자에게 보고한다.


### 수정 허용 파일

- `front/tests/unit/episodeUnlockDialog.test.ts`
- `front/tests/unit/episodeUnlockDialog.test.tsx`
- `front/tests/unit/sessionExpiredDialog.test.ts`
- `front/tests/unit/sessionExpiredDialog.test.tsx`

### 의존성과 checks

- depends_on: task-1.

checks: []. 적절한 독립 정적 TS 검사 명령이 없으므로 테스트 실행 없이 계약·시나리오 검토 결과를 완료 요약에 기록한다. 전체 타입·동작 검증은 task-7에 배정한다.

### 반복 작업 위임

불가. 각 플랫폼 이벤트·비동기 경합·생명주기 판단이 필요하여 독립적인 반복 치환으로 볼 수 없다. task-2~6은 최대 5개 부모 worker로 병렬 실행하며 공통 설정/지원 파일은 읽기 전용이다. 하위 에이전트를 생성하지 않는다.

### 주요 로직 코드 또는 변경 예시

독립적인 만료 팝업의 사용자 동작은 다음처럼 실제 컴포넌트로 검증한다.

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { SessionExpiredDialog } from '@/components/SessionExpiredDialog';

test('expiration dialog closes only through the chosen action', async () => {
  const onDismiss = jest.fn();
  const onLogin = jest.fn();
  const user = userEvent.setup();
  const view = render(
    <SessionExpiredDialog visible onDismiss={onDismiss} onLogin={onLogin} />,
  );
  expect(screen.getByText('로그인이 만료됐어요')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: '닫기' }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onLogin).not.toHaveBeenCalled();
  await user.press(screen.getByRole('button', { name: '로그인' }));
  expect(onLogin).toHaveBeenCalledTimes(1);
  view.rerender(
    <SessionExpiredDialog visible={false} onDismiss={onDismiss} onLogin={onLogin} />,
  );
  expect(screen.queryByText('로그인이 만료됐어요')).not.toBeOnTheScreen();
});
```

구매 시퀀스는 실제 episode fixture를 넣어 렌더링 → onShow/fade-in 완료 → 구매 버튼 연속 입력 → API 응답 → fade-out 완료 전 onPurchased=0 → fade-out 완료 후 iOS dismiss 전 onPurchased=0 → onDismiss 후 1회 → 중복 dismiss 뒤에도 1회를 검사한다. Android는 hidden commit 뒤 effect로 완료됨을 별도 검사한다. sessionVersion 변경 시 위 지연 응답/애니메이션을 끝내도 기존 onPurchased가 호출되지 않아야 한다.

