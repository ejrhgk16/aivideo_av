# task-1-points-demo-tests

## 기본 입력

- 이 task 문서, index.json의 task-1 항목, 컨텍스트로 전달된 적용 지침.
- 선행 task 없음. 승인된 범위는 포인트 가상 체험과 해당 화면의 기존 조회 회귀 검사다.

## 읽어야 할 파일

- front/tests/unit/pointsScreen.test.tsx: 기존 renderPoints/makeSession/deferred/transaction 및 조회·탭·계정·focus 시나리오.
- front/src/screens/PointsScreen.tsx: 현재 route 입력, useUser 소비, history 요청·표시·Modal을 붙일 위치.
- front/src/features/economy/pointHistory.ts, economyResponses.ts: getPointHistory와 PointHistoryItem/Page의 현재 export.
- front/src/features/user/UserProvider.tsx: useUser 반환 타입과 실제 points/sessionVersion/setPoints 경계만.
- front/tests/setup.ts, front/jest.config.cjs: 기존 환경·mock·cleanup 설정만.
- .agents/skills/react-native-testing/SKILL.md 및 references/api-reference-v13.md, references/expo.md; .agents/skills/javascript-typescript-jest/SKILL.md.
- front/package.json, package-lock.json: 위 스킬을 적용하는 데 필요한 설치 버전 항목만.

## 필요 시 참고할 문서

- 루트 AGENTS.md: 적용 지침이 누락되거나 변경된 경우만.
- _docs/ARCHITECTURE.md의 Frontend/Boundaries: 화면·API 경계 판단이 필요한 경우만.
- plan.md의 C1/C2/C5: 아래 계약 발췌에 누락·충돌이 있는 경우만. 계약을 추측하거나 변경하지 않는다.

## 실패 시 참고할 파일

- front/src/components/ui.tsx: 접근성 조회나 실제 공용 UI 렌더 실패 분석에 필요한 부분만.
- front/node_modules/expo-router의 설치된 testing-library export/Stack 구현: focus·재마운트 관찰이 실패할 때만 해당 부분을 확인한다.

## 작업

### 역할과 완료 조건

미구현 체험 기능의 테스트 작성 task다. 제품 코드를 수정하지 않는다. 다음 파일만 apply_patch로 수정한다. 다른 작업자도 함께 작업하므로 타인의 변경을 되돌리지 않는다.

```text
front/tests/unit/pointsScreen.test.tsx
```

- checks: `npm --prefix front run typecheck`를 직접 실행·통과한다. 새 제품 export/props를 추가하지 않으므로 이 검사는 현재 소스로 실행 가능하다.
- 새 체험 UI가 필요한 테스트 실행은 task-2로 유예한다. 전제는 task-2의 광고·충전 Modal, 로컬 잔액·내역, 초기화 및 C2 문구 구현이다. task-2가 `npm --prefix front run test -- tests/unit/pointsScreen.test.tsx tests/unit/pointHistory.test.ts tests/unit/episodeUnlockDialog.test.tsx`를 실행한다.
- 기존 조회·인증·빈 목록·오류·추가 페이지·중복·계정·focus 시나리오를 유지하며 바뀐 표시 관찰만 적응한다. 새로운 스타일을 소스 문자열·대량 snapshot·CSS 픽셀 assertion으로 검사하지 않는다.
- 완료 전 imports·실제 테스트 API·mock 상태·이벤트 순서·미완료 Promise를 자체 검토한다. C1/C5별 테스트 이름과 typecheck 결과, task-2로 유예한 동작 실행을 완료 요약에 적는다. 작성 완료는 기능 통과가 아니다.

### 적용 계약

- C1: `front/src/screens/PointsScreen.tsx`의 기존 named `PointsScreen(): React.JSX.Element`, props 없음. 기존 front/src/app/points.tsx에서 소비한다. `tab=history`는 이용 내역, 기본은 충전하기다.
- C1: 기존 named `getPointHistory(page?: number): Promise<PointHistoryPage>`는 기본 page1. API·응답 타입 변경 없음. 실제 거래의 UUID, transactionType, amount, balanceAfter, createdAt, episode를 보존한다.
- C1: 첫 체험의 실제 points 또는0을 시작값으로 사용. 광고 버튼 「광고 보고 포인트 받기」 → 「광고 체험」창의 「체험 완료」 → +10 P/내역1개, 방문당5회. 상품 button 접근성 이름 「100 P 충전 체험」/「300 P 충전 체험」/「600 P 충전 체험」 → 「충전 체험」창과 가격 → 「체험 충전하기」로 선택 포인트/내역1개. 「취소」·시스템 닫기는 가산0, 같은 창 중복 확정은1회만 반영한다.
- C1: 상태는 PointsScreen 로컬 소유. 잔액 label 「체험 포인트」, 가상 행 제목 「체험 내역」, 실제 행 제목 「실제 이용 내역」. 탭 전환 유지, blur/unmount 또는 UUID/sessionVersion 변경 시 잔액·행·횟수·창 초기화. 복원 중 체험 비활성, 비로그인은0부터 체험 가능. 실제 setPoints/setUser 및 구매·쓰기 호출 없음.
- C1: 실제 로딩·빈 목록·오류·비로그인 안내와 체험 행이 함께 표시될 수 있어야 한다. 서버 응답·page/hasNext·실잔액 변화는 이미 시작한 체험 잔액·행을 덮어쓰지 않는다. 기존 서울 날짜·시간·5종 거래명·부호·거래 후 잔액을 유지한다.
- C2: charge 탭의 준비 중 표시를 제거하고 「필요한 만큼 충전해요」·「예시 가격」·100/300/600 P와 ₩1,100/₩3,300/₩6,600을 제공한다. 실제 결제 없음과 화면 이탈 시 체험 초기화 안내를 확인한다.
- C5: 설치 Jest29.7.0/jest-expo57.0.6/RNTL13.3.3. 기존 mock target은 '@/features/economy/pointHistory'와 '@/features/user/UserProvider'. 실제 화면·공용 UI를 렌더링하고 기존 helper를 재사용한다. renderRouter/testRouter에 실제 Stack을 사용해 focus와 재마운트를 구분한다.

### 작성 지시

1. 기존 charge 예시 검사의 「준비 중」4개 기대를 상품 button·가격·광고 button 및 준비 중 부재 검사로 바꾼다. 실제 balance/history query 동작을 함께 보존한다.
2. 광고 확정·취소·5회 제한, 상품별 가격·가산·취소·재충전, 같은 창의 중복 확정을 검증한다. 중복 확정은 입력이 발생하는 시점과 모달 닫힘을 구분하며 필요 시 지원되지 않는 Modal native callback 경계를 이유와 함께 관찰한다. 정상 사용자 입력은 await userEvent를 사용한다.
3. 실제1,234 → 광고+10 → 상품100 →1,344, 가상 행2개와 실제 setPoints/setUser 미호출을 검사한다. history 탭에서는 실제 응답 fixture와 가상 행의 분리·서버 pagination 불변을 검사한다.
4. charge↔history와 query 변경에서 체험이 유지되는지, Stack blur/refocus·unmount/re-entry·UUID 변경·같은 UUID의 sessionVersion 변경에서는 초기화되는지 검사한다. 오래된 창 확인이 새 세션에 반영되지 않아야 한다.
5. 복원 중, 익명0 P, 실제 history 로딩/빈 목록/오류와 체험 행의 공존을 검사한다. 익명의 실제 history 로그인 이동을 유지한다.
6. 기존 실제 history 전용 검사는 기존 목적·assertion의 검증력을 유지한다. 5종 label·양음수·거래 후 잔액·자정 서울 시각·페이지 재시도·중복 제거·오래된 응답 폐기를 삭제하지 않는다.

### 반복 작업 위임

불가. 한 화면의 상태·상호작용 테스트이며 별도 설계 없이 반복할 독립 파일이 없다. 자식 슬롯0이다.

### 주요 로직 코드 또는 변경 예시

다음은 기존 helper와 확정 UI 이름을 사용하는 체험 누적 시나리오 예시다. 별도 제품 API를 도입하지 않고 테스트 파일 안의 helper만 필요에 따라 정돈한다.

```tsx
test('demo credits remain local while charge and history tabs share the demo', async () => {
  const input = userEvent.setup();
  const requests = installRequests();
  const session = makeSession(makeUser('user-a'), 1234, 1);
  const view = renderPoints(session, 'charge');

  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  await input.press(screen.getByRole('button', { name: '체험 완료' }));
  expect(screen.getByText('1,244 P')).toBeOnTheScreen();
  await input.press(screen.getByRole('button', { name: '100 P 충전 체험' }));
  expect(screen.getByText('충전 체험')).toBeOnTheScreen();
  await input.press(screen.getByRole('button', { name: '체험 충전하기' }));
  expect(screen.getByText('1,344 P')).toBeOnTheScreen();

  await input.press(screen.getByRole('tab', { name: '이용 내역' }));
  await act(async () => {
    requests.requests[0].resolve(page([
      transaction('real-1', 'EPISODE_UNLOCK', -30, 970,
        { dramaTitle: '작품', episodeNumber: 1 }),
    ]));
    await requests.requests[0].promise;
  });
  expect(screen.getByText('체험 내역')).toBeOnTheScreen();
  expect(screen.getByText('실제 이용 내역')).toBeOnTheScreen();
  expect(screen.getByText('1,344 P')).toBeOnTheScreen();
  expect(session.setPoints).not.toHaveBeenCalled();
  expect(session.setUser).not.toHaveBeenCalled();
  view.unmount();
});
```

위 예시에 필요한 userEvent import를 RNTL에서 추가한다. 한 예시로 취소·중복·수명·비동기 회귀를 대체하지 않는다. 실제 내역의 Promise를 완료하고 타이머·외부 작업을 남기지 않는다.
