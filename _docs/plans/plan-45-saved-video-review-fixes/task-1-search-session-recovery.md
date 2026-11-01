# task-1-search-session-recovery

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-45-saved-video-review-fixes/plan.md
- front/AGENTS.md
- front/src/screens/SearchScreen.tsx
- front/src/features/drama/dramaContent.ts
- front/src/features/user/UserProvider.tsx
- front/src/features/user/sessionClient.ts
- front/src/common/http/api.ts
- front/src/common/http/errorMessages.ts
- front/tests/unit/dramaDetailScreen.test.ts
- front/tests/unit/sessionExpiredDialog.test.ts
- front/scripts/test-front.cjs
- front/tests/unit/testFrontRunner.test.ts

## 작업

### 파일 범위

- front/src/screens/SearchScreen.tsx
- front/tests/unit/searchScreen.test.ts
- front/scripts/test-front.cjs

선언된 파일만 apply_patch로 수정한다. 다른 작업의 변경을 되돌리지 않는다. dev에서만 작업하고 branch·worktree·commit·push·계획 상태 직접 변경은 하지 않는다.

### 의존성과 검증

- depends_on: []

~~~text
npm --prefix front run test -- tests/unit/searchScreen.test.ts tests/unit/sessionExpiredDialog.test.ts tests/unit/testFrontRunner.test.ts
npm --prefix front run test
~~~

### 문제와 완료 목표

getDramaList는 선택 인증 요청으로 바뀌었지만 SearchScreen은 mount 시 한 번만 조회한다. 만료된 Access/Refresh로 첫 요청이 거절되면, 기존 검색 탭은 다시 로그인하거나 재방문해도 오류에 머물 수 있다. 기존 선택 인증 API는 유지하고 소비자의 수명 주기만 보완한다.

위 증상은 최초 실행 전 기준이다. 첫 실행에서 검색 화면·회귀 테스트 구현과 전체 프론트 검증이 완료되었다. 재점검 후 이 task를 다시 열었으며, 기존 검색 구현을 유지하고 오래된 계획 지시로 추가한 테스트 수동 등록만 제거한 뒤 재검증한다.

### 구현 지시

- useEffect([]) 조회를 useFocusEffect + useCallback 기반으로 바꾼다. 세션 복원이 끝난 뒤 조회하고 사용자 UUID·sessionVersion·포커스 복귀·명시적 재시도에 반응한다.
- 만료로 세션이 정리되면 현재 익명 세대에서 다시 조회할 수 있게 한다. 만료 팝업 닫기만으로 로그인 경로를 강제하지 않는다. 로그인 성공 후 같은 mounted 탭도 새 세대로 재조회한다.
- 이전 요청이 새 계정의 목록·오류·loading을 덮지 못하게 active/generation과 isCurrentSession을 적용한다. 화면 이탈·재시도 때도 이전 요청을 무효화한다.
- query와 선택 genre는 재조회만으로 초기화하지 않는다. loading·empty·error를 구분하고 기존 EmptyState의 action으로 다시 시도를 제공한다.
- getDramaList, 공통 세션 client, 서버의 선택 인증 규칙은 바꾸지 않는다. 검색 전용 public API를 새로 만들지 않는다.
- plan-44의 test-front.cjs는 tests/ 아래 모든 .test.ts(x)를 자동 탐색한다. 첫 실행에서 추가한 testFiles 상수와 자동 탐색 결과에 수동 목록을 합치는 코드만 제거해 기존 자동 탐색·선택 실행을 복구한다. searchScreen.test.ts는 자동 발견되므로 등록 코드를 추가하지 않는다.
- test-front.cjs는 위 정리만을 위해 수정 범위에 남긴다. 실행기 테스트는 수정하지 않고 선택 실행으로 확인한다. 실행기 정리의 회귀 검증 때문에 이 task만 무인자 전체 test도 한 번 실행한다. typecheck·export는 최종 $finish-plan에서 수행한다.
- 코드를 쓰기 전 front/AGENTS.md의 Expo v57 공식 버전 문서를 읽는다.

### 주요 로직 코드 또는 변경 예시

다음은 화면 조회의 핵심 흐름이다. accountKey는 사용자 UUID와 sessionVersion의 조합이며 현재 결과에도 태깅해 이전 계정 결과를 노출하지 않는다. 화면의 기존 필터링은 그대로 둔다.

~~~tsx
const { user, isRestoring, sessionVersion, isCurrentSession } = useUser();
const [retryCount, setRetryCount] = useState(0);
const generation = useRef(0);
const accountKey = String(sessionVersion) + ':' + (user?.uuid ?? 'anonymous');

useFocusEffect(useCallback(() => {
  const request = ++generation.current;
  if (isRestoring) return () => { generation.current += 1; };
  const version = sessionVersion;
  const current = () => generation.current === request && isCurrentSession(version);
  setState({ kind: 'loading', accountKey });
  void getDramaList().then(
    items => { if (current()) setState({ kind: 'loaded', accountKey, items }); },
    error => {
      if (!current() || error instanceof SessionChangedError) return;
      setState({ kind: 'error', accountKey, error });
    },
  );
  return () => { generation.current += 1; };
}, [isRestoring, user?.uuid, sessionVersion, isCurrentSession, retryCount]));
~~~

화면 상태 타입은 같은 파일에서 loading/loaded/error union으로 정의하거나 기존 상태에 소유 계정 태그를 추가하는 최소 방식으로 구현한다. error 화면의 다시 시도 버튼은 setRetryCount(count => count + 1)를 호출한다. 계정 태그가 현재 accountKey와 다르면 이전 loaded/error를 보여 주지 않는다.

### 회귀 검증과 완료 조건

- 만료된 인증 요청 실패 → 세션 version 증가·user null → 익명 조회 성공 후 검색 결과 복구.
- 만료 안내를 닫아도 로그인으로 자동 이동하지 않으며 익명 검색이 가능함.
- 로그인 성공·로그아웃·계정 UUID 변경 및 blur/focus 후 재조회.
- 복원 중 요청 없음, 네트워크 오류 재시도, 빈 결과와 조회 실패 구분.
- 이전 요청을 새 계정 응답 뒤에 resolve/reject해도 현재 결과가 유지됨.
- 검색어·장르 선택은 재조회 후에도 유지되고 반복 렌더로 요청 루프가 생기지 않음.
- 기존 VM 화면 harness 방식을 재사용하되 React hook과 focus mock을 안정된 참조/슬롯별로 관리한다. mock 문제를 피하려고 제품의 인증 규칙을 바꾸지 않는다.
- 선언한 두 checks가 모두 통과하고 test-front.cjs에 수동 등록 변경이 남지 않으면 완료한다. 서버가 필요한 UI 확인에서 서버가 없으면 실패로 보고 npm --prefix front run start -- --port 8081을 안내하고 자동 실행하지 않는다.
