# task-2-points-demo-source

## 기본 입력

- 이 task 문서와 index.json의 task-2 항목, 컨텍스트로 전달된 적용 지침 및 task-1 완료 요약.
- depends_on: task-1. 테스트 작성 완료 뒤 포인트 화면을 구현하고 해당 테스트를 실행한다.

## 읽어야 할 파일

- front/src/screens/PointsScreen.tsx: 현재 전체 화면의 charge/history·generation·session 처리와 styles.
- front/src/features/economy/pointHistory.ts, economyResponses.ts: 기존 getPointHistory, 실제 항목·페이지 경계.
- front/src/features/user/UserProvider.tsx: 실제 points/user/sessionVersion/isCurrentSession과 setPoints 소유권만.
- front/src/components/ui.tsx: 실제 AppText/Button/EmptyState/Page/SectionTitle/Icon의 현재 props·style 합성.
- front/src/common/theme/tokens.ts: 기존 색·폰트 값만.
- front/README.md: 전역 상태 섹션과 검증 선택 규칙.
- .agents/skills/vercel-react-native-skills/SKILL.md: 현재 RN 스타일·Modal·상태 지침. 설치된 React Native/Expo LinearGradient의 타입이 불명확할 때 해당 설치 타입만 확인한다.

## 필요 시 참고할 문서

- 루트 AGENTS.md: 전달된 적용 지침이 누락되거나 변경된 경우만.
- _docs/ARCHITECTURE.md의 Frontend/Boundaries: 화면·공유 코드 책임 판단이 필요한 경우만.
- plan.md의 C1/C2/C5: 아래 계약 발췌의 누락·충돌을 확인할 때만. 경계 변경이 필요하면 먼저 메인에게 보고한다.

## 실패 시 참고할 파일

- front/tests/unit/pointsScreen.test.tsx: 실패한 체험 또는 실제 조회 시나리오·fixture만.
- front/tests/unit/pointHistory.test.ts, episodeUnlockDialog.test.tsx: 해당 API/구매 회귀 실패 부분만.
- front/tests/setup.ts 및 RNTL/Jest 스킬의 관련 버전·Expo 경계: 테스트 환경 오류의 근거가 있을 때만.

## 작업

### 역할과 완료 조건

소스 구현·검증 task다. 다음 파일만 apply_patch로 수정한다. 다른 작업자가 함께 작업하므로 타인의 변경을 되돌리지 않고 기존 구현과 조정한다.

```text
front/src/screens/PointsScreen.tsx
front/README.md
```

- 테스트는 읽기 전용이다. 실패를 통과시키려고 assertion을 약화하거나 테스트 파일을 수정하지 않는다. 테스트 결함은 근거와 함께 메인에게 보고한다.
- checks는 다음 두 명령이며 모두 실행·통과해야 완료한다. 실패와 직접 관련된 검사를 먼저 실행하고 최종 수정 뒤 선언된 선택 회귀를 실행한다.

```powershell
npm --prefix front run typecheck
npm --prefix front run test -- tests/unit/pointsScreen.test.tsx tests/unit/pointHistory.test.ts tests/unit/episodeUnlockDialog.test.tsx
```

- C1/C2/C5의 구현과 타입·선택 테스트 통과, README 상태 소유권 설명, 담당 디자인의 자체 대조가 완료 조건이다. 전체 test/export는 이 task에서 반복하지 않는다.
- 기존8081의 /points와 /points?tab=history에서 작은360/모바일390/데스크톱 화면, 체험 취소·누적·내역·이탈 초기화를 확인한다. 서버·데이터·렌더링 도구 부족으로 시각 확인을 못 하면 그 사실과 남은 항목을 명시하며 코드 검사 통과와 구분한다. 서버를 자동 실행하지 않는다.

### 적용 계약

- C1: 기존 named `PointsScreen(): React.JSX.Element`, props 없음, 소비는 front/src/app/points.tsx의 `<PointsScreen />`. tab=history면 이용 내역, 기본 charge. 기존 `getPointHistory(page?: number): Promise<PointHistoryPage>`의 기본page1과 실제 PointHistoryItem/Page를 변경하지 않는다.
- C1: PointsScreen의 로컬 상태로 첫 체험 시 실제 points 또는0부터 시작. 「광고 보고 포인트 받기」 → 「광고 체험」 → 「체험 완료」로 +10 P, 방문당 최대5회. 「100 P 충전 체험」/「300 P 충전 체험」/「600 P 충전 체험」 → 「충전 체험」창에서 각각 ₩1,100/₩3,300/₩6,600 → 「체험 충전하기」로 선택 포인트 추가. 취소·시스템 닫기는0회 적립. 같은 창 중복 확인은1회만, 새 창의 재충전은 가능하다.
- C1: 「체험 포인트」와 「체험 내역」으로 표시하고 실제 행은 「실제 이용 내역」 아래 구분. 탭 전환 유지, blur/unmount 또는 UUID/sessionVersion 변경 시 잔액·행·횟수·창 초기화. 이전 세션의 행·창 노출 차단. 복원 중 버튼 비활성, 익명0부터 체험 가능. setPoints/setUser와 구매·쓰기 API 호출 없음.
- C1: 실제 로딩·빈 목록·오류·익명 로그인 안내가 체험 행을 가리지 않는다. 실제 history generation/session guard·페이징·중복 제거·재시도와 5종 거래명·부호·거래 후 잔액·서울 YYYY.MM.DD HH:mm 유지. 서버 응답·실잔액의 후속 변화는 이미 시작한 체험을 덮어쓰지 않는다.
- C2: 기존 배경 #0B0C0F·본문 #F7F7F2·강조 #CBF46A·Pretendard. 콘텐츠 최대780/중앙, 모바일 좌우22. 잔액 배경·테두리 없이 왼쪽, width<=700 숫자58/그 외64, 작은P31·연두색. 제목 「이야기를 계속하는 방법」/「MORE STORIES, MORE MOMENTS」 유지, 기본 안내 「마음에 드는 드라마의 다음 회차를 열어보세요.」. 체험 중 가상 잔액임을 표시한다.
- C2: 탭 #171B22/선택 #30363F와 반경12/9. 광고 #232B1D·약한 연두 테두리·gift 배경 #334325·반경15·오른쪽+10 P와 chevron·「광고 보상 체험 · 0/5회」부터 현재 횟수. 「필요한 만큼 충전해요」/「예시 가격」 아래 상품 배경 #171C23·반경14·원형P #2B3325·숫자21/23·가격 배지 #2A313B/반경9.
- C2: 이용 내역은 아이콘/거래명·시간·상세/오른쪽 금액의 가로 행과 얇은 구분선. 증가 연두색, 감소 본문색. 보조 색 #A1ACBA/#939FAD, 광고 #A3B194, 하단 #99A88C/#778491. 디자인을 맞추려고 실제 상세·잔액·시간을 삭제하지 않는다.
- C2: 「실제 결제되지 않으며 체험 포인트는 이 화면을 나가면 초기화돼요.」와 「한 번 연 회차는 다시 볼 때 무료예요.」 안내. charge 관련 준비 중 제거. 기존 뒤로 back/fallback /account와 내비게이션 구조 유지. 다른 화면의 전역 색·AppTopBar 실제 잔액은 변경하지 않는다.
- C5: task-1의 실제 화면 RNTL 검사를 실행하고 테스트 내부는 실패 분석 때만 읽는다. 서버·DB fixture·새 제품 export를 만들지 않는다.

### 구현 지시

1. 기존 실제 history 상태·API 호출은 보존하고, 체험 상태와 열린 Modal만 화면 로컬에 추가한다. 체험 상태에는 사용자/세션 소유권, 시작값 기반 잔액, 가상 행, 광고 완료 횟수, 중복 확인을 막을 열린 창 식별을 포함한다. private 타입·helper는 이 파일 안에 두고 export하지 않는다.
2. 체험 완료는 동일 창에 대해 가산·행 추가·광고 횟수·창 닫기를 한 상태 전이로 처리한다. 취소는 창만 닫는다. 시간·식별값은 상태 updater 재실행에도 중복 생성되지 않게 처리한다. actual setPoints나 API 상품·광고 호출은 추가하지 않는다.
3. 계정 UUID/sessionVersion 및 focus 소유권을 기준으로 오래된 창의 확인·늦은 callback을 폐기한다. 실제 history용 기존 useFocusEffect의 active 의존성 때문에 탭 전환 시 체험까지 초기화하지 않도록 체험 수명 처리를 구분한다. blur에서는 화면이 Stack에 남아 있어도 체험을 정리한다.
4. 가상 행이 실제 목록의 로딩/오류/익명/빈 상태와 공존하도록 history 내용을 구성한다. 기존 FlatList의 ListHeaderComponent 등 현재 목록 구조를 활용하고 같은 방향의 가상화 목록/ScrollView를 중첩하지 않는다. 서버 page·hasNext와 가상 행은 분리한다.
5. C2의 수치·문구·아이콘·배치를 화면 styles로 적용한다. 상품·광고는 전체 행을 Pressable button으로 만들고 Modal은 취소 및 onRequestClose를 지원한다. 실제 항목의 상세·거래 후 잔액은 가로 행의 보조 정보로 유지한다. 작은 폭에서 가격·금액이 잘리지 않게 조절한다.
6. front/README.md의 전역 상태 섹션에 「포인트 체험 잔액·내역·광고 횟수는 PointsScreen 로컬 상태이며 탭 전환 동안 유지하고 화면 이탈·계정/세션 변경 시 초기화한다. 실제 UserProvider 포인트와 API 거래는 변경하지 않는다.」를 기존 문맥에 맞춰 추가한다.

### 반복 작업 위임

불가. 한 화면의 상태·수명·UI가 연결된 구현이며 확정된 반복 파일 작업이 아니다. 자식 슬롯0이다.

### 주요 로직 코드 또는 변경 예시

다음은 원자적 완료 처리와 소유권의 예시다. private 구조는 강제하지 않지만 열린 창 id 확인·같은 세션 확인·잔액과 내역의 동시 갱신은 보존한다. begin에서 `balance: points ?? 0`, `items: []`, `adCount: 0`, 현재 ownerKey를 초기값으로 만들며 취소는 pending만 null로 바꾼다.

```tsx
type PendingDemo = { id: number; kind: 'ad' | 'pack'; amount: number };
type DemoState = {
  ownerKey: string;
  balance: number;
  items: PointHistoryItem[];
  adCount: number;
  pending: PendingDemo | null;
};

const ownerKey = `${user?.uuid ?? 'anonymous'}:${sessionVersion}`;
const ownerRef = useRef(ownerKey);
ownerRef.current = ownerKey;
const focusedRef = useRef(false);
const [demo, setDemo] = useState<DemoState | null>(null);
const currentDemo = demo?.ownerKey === ownerKey ? demo : null;

// 이 effect에는 charge/history(active)를 의존성으로 넣지 않는다.
useFocusEffect(useCallback(() => {
  focusedRef.current = true;
  return () => {
    focusedRef.current = false;
    setDemo(null);
  };
}, [ownerKey]));

function confirmDemo(id: number) {
  if (!focusedRef.current || ownerRef.current !== ownerKey || isRestoring) return;
  const createdAt = new Date().toISOString();
  setDemo((previous) => {
    if (previous?.ownerKey !== ownerKey || previous.pending?.id !== id) return previous;
    const pending = previous.pending;
    if (pending.kind === 'ad' && previous.adCount >= 5) return previous;
    const balanceAfter = previous.balance + pending.amount;
    const item: PointHistoryItem = {
      uuid: `demo-${id}`,
      transactionType: pending.kind === 'ad' ? 'AD_REWARD' : 'PURCHASE',
      amount: pending.amount,
      balanceAfter,
      createdAt,
      episode: null,
    };
    return {
      ...previous,
      balance: balanceAfter,
      items: [item, ...previous.items],
      adCount: previous.adCount + (pending.kind === 'ad' ? 1 : 0),
      pending: null,
    };
  });
}
```

예시의 PointHistoryItem은 기존 feature에서 type import한다. begin은 단조 증가하는 창 id를 부여하고 5회가 끝난 광고를 열지 않는다. 표시·취소·Modal 확인의 호출 지점은 각각 광고/상품 Pressable → pending 설정, 「취소」/onRequestClose → pending 정리, 「체험 완료」/「체험 충전하기」 → confirmDemo(pending.id)다. 실제 history API 결과는 기존 history 상태에만 저장한다.
