# plan-54-points-demo-design

## 목표

포인트 화면과 내 정보 포인트 카드를 승인된 디자인으로 맞추고, 광고·충전의 비활성 준비 중 표시를 가상 잔액·내역까지 확인하는 체험으로 바꾼다. 보관함은 목록 스크롤을 유지하면서 스크롤바만 숨긴다. 범위와 공통 계약·4개 task 구성은 사용자 승인을 받았다.

### 범위와 비목표

- 프론트의 PointsScreen, AccountScreen의 포인트 카드·포인트 관련 이용 안내, LibraryScreen의 목록 표시, 관련 포인트 테스트 및 front/README.md만 변경한다.
- 가상 체험은 PointsScreen 로컬 상태다. 충전하기↔이용 내역 전환 동안 유지하고 화면 blur/unmount 또는 사용자·sessionVersion 변경 시 초기화한다. 실제 잔액·회차 권한·서버 거래는 변경하지 않는다.
- 기존 실제 이용 내역 API와 인증·계정 격리·페이지·재시도·서울 시각 표시를 보존한다. 실제 이용 내역을 체험 데이터로 대체하지 않는다.
- 화면 스타일은 화면 파일 안에서 적용한다. 공통 theme/UI, UserProvider/sessionClient, REST/DB, 라우트·하단 내비게이션 구조, 다른 계정 설정과 다른 화면의 준비 중 표시는 범위 밖이다.
- 새로운 공유 컴포넌트·provider·저장소·의존성·상품 API·광고 SDK를 만들지 않는다. 기존 expo-linear-gradient를 사용한다.
- 앞선 비교에서 확인한 시각 기준을 아래 C2/C3에 고정한다. web-prototype/은 읽기·수정·검증 대상이 아니다.
- 기존 화면 책임 안의 변경이므로 ARCHITECTURE.md의 계층·파일 책임을 바꾸지 않는다. 로컬 체험과 실제 전역 상태의 차이는 front/README.md의 전역 상태 섹션에 기록한다.
- dev에서만 작업하며 branch/worktree를 만들거나 직접 commit/push하지 않는다. 이 단계는 계획 작성이며 제품 구현·테스트 실행은 하지 않는다.

## 공통 계약

### C1: 포인트 화면 진입·가상 체험·실제 조회 경계

정의·구현 책임 task-2, 테스트 소비 task-1. 기존 named export와 라우트 소비를 유지하며 테스트 전용 props나 제품 export를 추가하지 않는다. 아래 반환 타입은 현재 JSX 반환 경계의 설명이며 타입 주석 추가를 요구하지 않는다.

```ts
// front/src/screens/PointsScreen.tsx: named export
export function PointsScreen(): React.JSX.Element;
// 소비: front/src/app/points.tsx의 default PointsRoute가 <PointsScreen /> 렌더링
// query: tab=history이면 이용 내역, 생략/그 외 값이면 충전하기

// front/src/features/economy/pointHistory.ts: 기존 named export, 변경 없음
export function getPointHistory(page?: number): Promise<PointHistoryPage>;
// page의 기존 기본값: 1

// front/src/features/economy/economyResponses.ts: 기존 named types, 변경 없음
export type PointTransactionType =
  | 'PURCHASE' | 'AD_REWARD' | 'EPISODE_UNLOCK' | 'ADMIN_ADJUSTMENT' | 'REFUND';
export type PointHistoryItem = {
  uuid: string;
  transactionType: PointTransactionType;
  amount: number;
  balanceAfter: number;
  createdAt: string;
  episode: { dramaTitle: string; episodeNumber: number } | null;
};
export type PointHistoryPage = {
  items: PointHistoryItem[];
  page: number;
  hasNext: boolean;
};
```

상태 소유권과 표시:

- useUser()의 실제 points/user/isRestoring/sessionVersion/isCurrentSession을 읽고, 체험에서는 setPoints/setUser/login 또는 구매·쓰기 API를 호출하지 않는다. getPointHistory는 기존 읽기 전용 호출을 유지한다.
- 첫 체험 조작 시점의 실제 points를 시작값으로 가져오고 null이면 0으로 시작한다. 확정 뒤에는 로컬 잔액을 가산한다. 체험 시작 전에는 기존 실제 잔액, null이면 「—」를 표시한다.
- 가상 잔액의 label은 「체험 포인트」, 가상 기록 영역의 제목은 「체험 내역」이다. 상품과 안내의 예시 표시는 유지한다.
- 충전하기↔이용 내역 탭 전환은 로컬 잔액·내역·광고 횟수·열린 체험창을 초기화하지 않는다. 화면 blur/unmount 또는 사용자 UUID/sessionVersion 변경은 체험 잔액·내역·횟수·열린 창을 초기화한다. 계정 변경 render에서 이전 계정의 체험이 노출되지 않도록 소유권도 검사한다. 복원 중 체험 버튼은 비활성이며 복원 완료 후 현재 세션을 기준으로 시작한다.
- 실잔액이 백그라운드에서 바뀌어도 이미 시작한 체험 잔액과 합산하지 않는다. 화면 재진입 또는 계정 변경 후 다음 체험은 최신 실잔액에서 새로 시작한다.
- 비로그인도 0 P부터 체험할 수 있다. 실제 이용 내역 부분의 기존 로그인 안내·로그인 이동을 보존하며, 비로그인 요청으로 실제 이용 내역 API를 호출하지 않는다.

입력 → 결과:

| 트리거 | 결과 |
| --- | --- |
| button 「광고 보고 포인트 받기」 | 제목 「광고 체험」인 체험창. 「취소」 또는 시스템 닫기는 적립하지 않음 |
| 광고창 button 「체험 완료」 | +10 P와 최신순 체험 내역 1개, 거래 후 가상 잔액·시간 기록. 창 닫힘. 같은 창의 중복 확인은 1회만 반영 |
| 광고 5회 확정 | 해당 화면 방문의 광고 횟수 5/5. 광고 버튼 비활성. 날짜별 제한·지속 저장·실제 광고 타이머는 추가하지 않음 |
| button 「100 P 충전 체험」 / 「300 P 충전 체험」 / 「600 P 충전 체험」 | 제목 「충전 체험」인 체험창에 선택 포인트와 각각 ₩1,100/₩3,300/₩6,600 표시 |
| 충전창 button 「체험 충전하기」 | 선택 포인트 추가, 체험 내역 1개 기록, 창 닫힘. 중복 확인 1회만 반영. 새 창에서 다시 충전 가능 |
| 충전창 취소·시스템 닫기 | 잔액·내역 변화 없음 |
| 실제 이용 내역 탭 조회·재시도·추가 페이지 | 기존 getPointHistory와 sessionVersion/요청 generation 검사를 유지. 체험 행의 개수는 서버 page/hasNext에 포함하지 않음 |

- 모달은 React Native Modal을 이용하고 제목을 접근 가능하게 제공한다. 체험 상품은 Pressable button이며 위 접근성 label을 가진다. 광고·충전 화면에서 「준비 중」/「준비 중이에요」를 제거한다. 「예시 가격」 및 실제 결제가 없다는 안내는 유지한다.
- 가상 내역은 서버 배열을 수정하지 않고 최신순으로 별도 표시한다. 실제 내역과 함께 볼 때 가상 행은 항상 「체험 내역」 아래, 실제 행은 「실제 이용 내역」 아래에 둔다. 가상 행이 있을 때 실제 목록이 로딩·빈 목록·오류·비로그인이어도 가상 내역을 볼 수 있어야 한다. 화면은 스크롤 가능하게 유지하고 서버 FlatList를 같은 방향의 ScrollView 안에 중첩하지 않는다.
- 실제 항목의 5종 거래명, 부호 있는 금액, 거래 후 잔액, 회차 정보, 기존 YYYY.MM.DD HH:mm 서울 시각을 유지한다. 실제 목록의 중복 UUID 제거·추가 페이지 중복 호출 방지·오래된 응답 폐기를 보존한다.
- 취소 전후·확정 전후 또는 서버 응답으로 가상 상태가 덮어써지지 않아야 한다. 예: 실제 1,234 P → 광고 완료 → 1,244 P → 100 P 체험 충전 → 1,344 P, 체험 행 2개, 실제 setPoints 호출 없음.

검증: task-1의 pointsScreen RNTL 시나리오 작성과 task-2 선택 실행. 기존 pointHistory/episodeUnlockDialog 회귀로 실제 조회·구매 경계 보존 확인.

### C2: 포인트 화면 시각 기준

구현 책임 task-2, 동작·문구 검사 task-1. 화면 내부 스타일만 사용하며 C3와 구현 파일을 공유하지 않는다.

| 항목 | 기준 |
| --- | --- |
| 기본 | 배경 #0B0C0F, 본문 #F7F7F2, 강조 #CBF46A, Pretendard 유지. 화면 콘텐츠 최대 폭 780, 중앙 배치, 모바일 좌우 22 |
| 제목·뒤로 | 「이야기를 계속하는 방법」, 「MORE STORIES, MORE MOMENTS」 유지. 뒤로 동작은 기존 back/fallback /account 유지. 제목 모바일 약25, 큰 화면 약32 |
| 잔액 | 테두리·배경 카드 없이 왼쪽 정렬. 700 이하에서 숫자58, 큰 화면64, P는31과 #CBF46A. 기본 안내 「마음에 드는 드라마의 다음 회차를 열어보세요.」, 체험 중에는 체험 잔액임을 표시 |
| 탭 | 트랙 #171B22, 선택 #30363F, 둥근 모서리12/9, 전체 높이 약48~49. charge/history 의미 유지 |
| 광고 | 배경 #232B1D, 연두색의 약한 테두리, 반경15. gift 아이콘 영역 #334325, 오른쪽 +10 P와 chevron. 「광고 보고 포인트 받기」 및 「광고 보상 체험 · 0/5회」로 시작하는 현재 횟수 |
| 상품 | 제목 「필요한 만큼 충전해요」, 보조 「예시 가격」. 배경 #171C23, 반경14, 원형 P 영역 #2B3325. 포인트 숫자 모바일21/큰 화면23, 작은 P. 오른쪽 가격 배지 #2A313B, 반경9 |
| 이용 내역 | 개별 배경 카드 대신 아이콘 / 거래명·시간·상세 / 오른쪽 금액의 가로 행과 얇은 구분선. 증가 금액 #CBF46A, 감소 금액 본문색. C1의 실제 상세·잔액·시간 보존 |
| 보조 문구 | 영역별 #A1ACBA, #939FAD, 광고 #A3B194, 하단 #99A88C/#778491를 사용해 회색 카드 일변도 표현을 줄임 |

- 체험 안내는 「실제 결제되지 않으며 체험 포인트는 이 화면을 나가면 초기화돼요.」를 제공한다. 하단 「한 번 연 회차는 다시 볼 때 무료예요.」와 체크 아이콘을 배치한다.
- 360 이하에서도 상품·가격·우측 금액이 겹치지 않도록 flex/minWidth와 문구 줄바꿈을 조절한다. 정상 세로 스크롤로 긴 내용에 접근한다.
- 기존 상단·하단 내비게이션 구조는 재배치하지 않는다. AppTopBar의 전역 실제 잔액을 가상 잔액으로 변경하지 않는다.
- RNTL로 CSS 픽셀 스냅샷·소스 문자열 검사를 추가하지 않는다. 디자인은 위 값과 기존 8081 화면의 모바일/데스크톱 시각 확인으로 비교한다.

### C3: 내 정보 카드와 실제 포인트 소유권

정의·구현 책임 task-3. 소비는 기존 front/src/app/(tabs)/account.tsx의 default AccountRoute와 사용자의 카드 클릭이다. C1의 가상 상태를 공유하거나 import하지 않는다.

```ts
// front/src/screens/AccountScreen.tsx: 기존 named export, props 없음
export function AccountScreen(): React.JSX.Element;
```

- useUser().points를 표시한다. null이면 「—」와 로그인 후 확인 안내를 유지한다. 이 카드와 기존 AppTopBar는 가상 잔액·내역을 표시하지 않는다.
- 카드 배경은 기존 설치된 expo-linear-gradient의 LinearGradient로 #272F22 → #171C18, 테두리 #CBF46A18, 반경 모바일18/큰 화면20.
- 카드 왼쪽 「내 포인트」와 잔액, 오른쪽 「충전하기」 및 arrow-right. 숫자 모바일39/큰 화면45, #E1F8C3, 작은 P 모바일 약23, label #B8C3B1. 기존 번개 아이콘·세로 설명 중심의 구성을 교체한다.
- 카드 클릭 → /points, 기존 「포인트 이용 내역」 클릭 → /points?tab=history 유지. 사용자명·프로필·계정 badge·나머지 메뉴·모달 동작은 유지한다.
- 이용 안내의 오래된 「포인트 조회와 사용은 아직 제공되지 않아요」를 「포인트 잔액과 이용 내역을 확인할 수 있어요. 광고와 충전은 실제 결제 없이 체험할 수 있어요. 체험 포인트는 포인트 화면을 나가면 초기화돼요.」로 교체한다. 다른 설정의 준비 중 표시는 건드리지 않는다.
- 스타일 변경은 되돌리기 쉬운 화면 변경이며 별도 테스트 task를 만들지 않는다. typecheck와 기존 episodeUnlockDialog 회귀를 실행하고 실제 카드의 그라데이션·문구·이동을 시각 확인한다. episodeUnlockDialog는 실제 포인트 구매 흐름의 회귀이며 카드 자체의 렌더 검사를 대신한다고 주장하지 않는다.

### C4: 보관함 스크롤바 표시

정의·구현 책임 task-4. 기존 front/src/app/(tabs)/library.tsx의 default LibraryRoute가 소비한다.

```ts
// front/src/screens/LibraryScreen.tsx: 기존 named export, props 없음
export function LibraryScreen(): React.JSX.Element;
// 기존 공용 FlatList에만 추가
// showsVerticalScrollIndicator={false}
```

- 저장한 작품·시청 기록 양쪽이 사용하는 기존 세로 FlatList에 showsVerticalScrollIndicator={false}를 추가한다.
- scrollEnabled=false, overflow:hidden으로 콘텐츠 자르기, 다른 컨테이너로 목록 교체, 전역 CSS 변경은 하지 않는다. 휠·터치 스크롤과 마지막 항목 접근을 유지한다.
- 기존 onEndReached/loadNextPage, 더 보기/재시도, 로그인·탭·세션 처리, UUID 중복 제거, 카드와 재생 경로를 유지한다.
- 새 동작 로직이 없는 한 줄 prop 변경이다. 기존 libraryScreen.test.tsx를 실행하고, 실제 8081의 충분히 긴 두 탭에서 스크롤바가 보이지 않으면서 마지막 항목에 접근되는지 확인한다. 별도 테스트 파일은 만들지 않는다.

### C5: 테스트 경계·데이터·검증 책임

작성 책임 task-1, 실행 책임 task-2. task-3/task-4는 아래 자신의 관련 회귀만 실행한다.

- 설치 확인값: Jest 29.7.0, jest-expo 57.0.6, RNTL 13.3.3, React Native 0.86.3, React 19.2.3. package.json/lockfile과 설치된 export를 기준으로 하며 업그레이드하지 않는다.
- 적용: .agents/skills/react-native-testing/SKILL.md, references/api-reference-v13.md, references/expo.md 및 .agents/skills/javascript-typescript-jest/SKILL.md. front/tests/setup.ts의 safe-area/Feather mock과 자동 cleanup을 재사용한다.
- 실제 PointsScreen·공용 UI와 expo-router/testing-library의 renderRouter/testRouter를 사용한다. 기존 pointsScreen.test.tsx의 makeSession/makeUser/renderPoints/installRequests/page/transaction/deferred를 확장한다. 상태 유지·blur 검사는 실제 Stack layout을 사용해 재마운트와 구분한다.
- 기존 외부 mock target은 '@/features/economy/pointHistory'의 getPointHistory와 '@/features/user/UserProvider'의 useUser다. session의 setPoints/setUser는 jest.fn() 그대로 검증한다. 스타일 검사를 위해 공용 UI·Modal·React를 통째로 mock하지 않는다. 추가 제품 export나 test 전용 props를 만들지 않는다.
- 기본 체험 데이터: 사용자A 1,234 P/version1, 사용자B 4,321 P/version2, 비로그인 null/version3. 광고1회 +10, 상품100/300/600. 날짜가 필요하면 고정 시간을 사용하고 테스트가 바꾼 clock을 정리한다.
- 실제 내역 fixture는 위 PointHistoryPage 형태로 transaction('real-1', 'EPISODE_UNLOCK', -30, 970, {dramaTitle:'작품', episodeNumber:1}) 등을 사용한다. 기존 5종 거래·자정 서울 시각·동일 UUID의 추가 페이지·offline 에러·늦은 사용자A 응답을 보존한다.
- 체험 검사 순서: charge 진입 → 광고/상품 button → 모달 확인/취소 → 표시 잔액과 체험 행 → history 탭 → 실제 API 응답 완료 → 두 내역 구분 → charge 복귀 → focus/계정 변경. 복원 중과 비로그인도 독립 검사한다. 일반 입력은 await userEvent, 외부 deferred 완료는 await act로 처리한다.
- 필수 경계: 취소0회 적립, 같은 창의 중복 확인1회, 별도 재충전 가능, 광고5회 제한과 취소는 횟수 미증가, 탭 유지·blur/unmount/session 변경 초기화, 체험 중 실제 응답이 체험을 덮어쓰지 않음, setPoints/setUser 미호출.
- task-1은 미래 UI 문구·상호작용 검사 작성 후 typecheck를 실행한다. 새 제품 export를 도입하지 않으므로 타입 검사는 현재 제품으로 가능하다. 미래 체험 버튼·모달·상태가 필요한 pointsScreen 동작 실행은 task-2로 유예한다. 기존 조회 회귀 시나리오는 삭제하거나 약화하지 않고 새 디자인의 문구·배치에 필요한 관찰만 적응한다.
- task-2는 pointsScreen + pointHistory + episodeUnlockDialog를 선택 실행한다. task-3는 typecheck + episodeUnlockDialog, task-4는 libraryScreen을 실행한다. 라이브 API/DB fixture·파일 출력은 없다.
- 시각 확인: 기존 http://localhost:8081에서 /points, /points?tab=history, /account, /library 및 /library?tab=history를 모바일 약390/작은360/데스크톱 폭에서 확인한다. 실제 내역·보관함은 로그인과 충분한 기존 데이터가 필요하다. 실제 데이터를 파괴하거나 가짜 서버 거래를 생성하지 않는다.
- 서버가 없으면 화면 검증 실패를 보고하고 `npm --prefix front run start -- --port 8081`을 안내한다. 자동 실행·다른 포트 우회는 하지 않는다. 렌더링 도구·충분한 데이터가 없으면 시각·스크롤 검증 미실행을 명시하며 HTTP200/typecheck/Jest만으로 시각 통과를 주장하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 포인트 테스트 작성 | front/tests/unit/pointsScreen.test.tsx | C1/C5 체험·수명·기존 실제 조회 시나리오와 C2 문구 적응. 작성 중 typecheck |
| 2 | 포인트 구현·검증 | front/src/screens/PointsScreen.tsx, front/README.md | C1/C2 로컬 체험·디자인 구현, 상태 설명, task-1 및 API/구매 회귀 실행 |
| 3 | 내 정보 카드 디자인 | front/src/screens/AccountScreen.tsx | C3 그라데이션·잔액·충전 링크 및 포인트 안내 정합화 |
| 4 | 보관함 스크롤바 숨김 | front/src/screens/LibraryScreen.tsx | C4 한 줄 prop 추가, 기존 목록 회귀 실행 |

## 실행 순서 및 병렬 작업

- task-1 → task-2: 테스트 작성 완료 뒤 해당 소스를 구현하고 미래 UI가 필요한 테스트를 실행한다. task-2의 depends_on은 task-1이다.
- task-1·task-3·task-4는 depends_on이 없고 수정 파일·fixture·생성 출력이 독립적이므로 병렬 실행 가능하다. task-2도 선행 task-1 완료 후 task-3/task-4와 병렬 실행 가능하다.
- typecheck는 읽기만 하고 Jest는 선택 파일과 각 process의 mock을 사용한다. 다른 worker가 파일을 쓰는 순간의 일시적 실패는 다른 작업을 되돌리지 말고 파일 작성 완료를 확인한 뒤 재검증한다.
- 메인 이외 동시 worker는 최대3명, 자식 예약0명, 전체 한도5명 이내다. 4개 task 모두 반복 작업 위임 불가: 각각 개별 화면·테스트 책임이며 확정된 다수 파일 반복 패턴이 아니다.
- task-3/task-4는 기존 검사로 충분한 작은 스타일·prop 변경이므로 빈 테스트 작성 task를 추가하지 않는다. task-1/task-2는 상태·상호작용 변경이므로 테스트·소스 역할을 분리한다.
- worker는 다른 작업자의 변경을 되돌리지 않고 자기 files만 apply_patch로 수정한다. 테스트 결함·계약 충돌은 공통 규칙에 따라 메인에게 근거를 보고하고 관련 task를 보류한다.

## 검증 명령과 완료 기준

- task-1: `npm --prefix front run typecheck`. 계약별 시나리오·mock·비동기 완료 조건을 자체 검토하고 실제 동작 실행은 task-2로 인계한다.
- task-2: `npm --prefix front run typecheck`, `npm --prefix front run test -- tests/unit/pointsScreen.test.tsx tests/unit/pointHistory.test.ts tests/unit/episodeUnlockDialog.test.tsx`.
- task-3: `npm --prefix front run typecheck`, `npm --prefix front run test -- tests/unit/episodeUnlockDialog.test.tsx`.
- task-4: `npm --prefix front run test -- tests/unit/libraryScreen.test.tsx`.
- 소스 task는 모든 선언 checks 통과와 담당 계약 자체 검토 후 완료한다. 테스트를 고쳐 통과시키지 않는다. 시각 확인의 실행 여부·데이터/도구 제한은 완료 요약에서 별도 보고한다.
- 화면·API 소비의 영향이 위 세 화면과 기존 실제 구매 경계로 한정되고 공유 UI/전역 상태/실행기를 변경하지 않으므로 task별 전체 test/export 반복은 하지 않는다. 최종 `$finish-plan`은 공통 규칙에 따라 프론트 typecheck/test/export를 전체 실행한다. 이 계획은 finish를 실행하거나 commit/push하지 않는다.
