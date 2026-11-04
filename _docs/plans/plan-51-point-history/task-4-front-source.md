# task-4-front-source

## 기본 입력

- 이 task 문서와 index.json의 task-4 항목
- 컨텍스트로 전달된 적용 지침, task-2의 API 구현·HTTP 검증 결과, task-3의 테스트 작성·시나리오 검토 결과
- task-2와 task-3 완료 후 실행한다. 역할은 소스 구현 및 테스트 실행이다.

## 읽어야 할 파일

- `front/src/screens/PointsScreen.tsx`: 기존 잔액·탭·뒤로 가기·충전 UI를 유지하며 이용 내역을 추가한다.
- `front/src/features/economy/episodePurchase.ts`, `economyResponses.ts`: 기존 economy 요청/응답 스타일. 새 pointHistory.ts도 같은 책임에 둔다.
- `front/src/features/playback/watchHistory.ts`: 인증된 페이지 GET의 직접 참고 패턴
- `front/src/features/user/UserProvider.tsx`: points/isRestoring/user/sessionVersion/isCurrentSession 계약. 구현을 변경하지 않는다.
- `front/src/screens/LibraryScreen.tsx`: 화면 로컬 목록·소유자·세대·포커스 수명주기의 필요한 구간만 참고한다. 공통 목록 추상화는 만들지 않는다.
- `front/src/components/ui.tsx`: Page/EmptyState/Button/AppText props와 scroll 동작
- `_docs/api/00-overview/error-code.md`: 기존 오류 안내·세션 갱신 규칙
- `front/README.md`의 현재 연결 상태 구간
- task-2가 제공한 GET 계약·검증 결과. 백엔드 구현을 다시 읽을 필요는 없다.

## 필요 시 참고할 문서

- 전달되지 않았거나 변경된 적용 루트/`front/AGENTS.md`만 다시 확인한다. 실제 코드 작성 전에 front/AGENTS.md의 정확한 Expo v57 문서 확인을 수행한다.
- `_docs/ARCHITECTURE.md`의 Frontend 및 Frontend global state: 상태 책임/계층 경계가 불명확할 때 참고한다. 관련 내용은 기본 입력으로 전달받은 것을 재사용한다.
- `_docs/api/05-economy/points.md`: task-2 결과와 본 task 계약의 누락·충돌이 의심될 때만 확인한다.
- `plan.md`의 프론트 계약/검증 계획: 본 task에 없는 누락·충돌이 있을 때만 참고한다.
- 실제 React Native 구현 시 `vercel-react-native-skills` 스킬을 적용하되 기존 UI·사용자 승인 범위를 유지한다.

## 실패 시 참고할 파일

- `front/tests/unit/pointHistory.test.ts`: 정확한 요청·인증·응답 전달 assertion이 실패한 경우
- `front/tests/unit/pointsScreen.test.ts`: 표시·시간·비동기 상태·페이지/계정 전환 assertion이 실패한 경우
- `front/tests/unit/episodePurchase.test.ts`, `episodeUnlockDialog.test.ts`: 기존 구매 회귀 실패 시 해당 시나리오
- `front/src/features/user/sessionClient.ts`, `front/src/common/http/api.ts`, `errorMessages.ts`: 공통 요청/세션/오류와의 실제 통합 문제가 있을 때만 읽는다. 수정 대상이 아니다.
- 실행만을 위해 테스트 내부를 모두 읽을 필요는 없다. 테스트 결함은 증거와 함께 보고하며 이 task에서 assertion·mock을 수정해 통과시키지 않는다.

## 작업

### 역할과 완료 조건

정확한 수정 허용 파일:

```text
front/src/features/economy/pointHistory.ts
front/src/features/economy/economyResponses.ts
front/src/screens/PointsScreen.tsx
front/README.md
```

checks:

```text
npm --prefix front run test -- tests/unit/pointHistory.test.ts tests/unit/pointsScreen.test.ts tests/unit/episodePurchase.test.ts tests/unit/episodeUnlockDialog.test.ts
```

구현 후 신규 요청/화면과 기존 구매 회귀 테스트가 모두 실행·통과해야 완료한다. 공통 HTTP·UserProvider·구매·라우터·테스트 실행기 코드는 변경하지 않는다. 테스트 파일은 읽기 전용이다. task-3 완료는 작성 완료이며 기능 통과가 아니므로 검증을 생략하지 않는다.

### 요청·타입

- economyResponses.ts의 기존 EpisodePurchaseResponse를 유지하고 `PointTransactionType`, `PointHistoryItem`, `PointHistoryPage`를 추가한다.
- transactionType은 PURCHASE/AD_REWARD/EPISODE_UNLOCK/ADMIN_ADJUSTMENT/REFUND. item 필드는 uuid, transactionType, amount, balanceAfter, createdAt, episode다.
- amount와 balanceAfter는 숫자, createdAt은 UTC ISO 문자열, episode는 `{ dramaTitle: string; episodeNumber: number } | null`이다. page 응답은 items/page/hasNext다.
- pointHistory.ts에서 getPointHistory(page=1)를 export하고 관련 타입을 re-export한다. 기존 sessionClient.apiRequest에 `/me/points/transactions?page=` + encodeURIComponent(page), auth:'required'로 요청한다.
- 응답을 그대로 반환한다. 공통 세션 갱신·오류 처리·환경 URL 구성은 재사용하고 새로운 client/cache/provider를 만들지 않는다.

### 화면 동작과 상태

- charge 탭·뒤로 가기·현재 포인트 표시·예시 상품/가격·준비 중 버튼을 유지한다. history 탭의 기존 준비 중 EmptyState만 실제 조회 흐름으로 교체한다.
- 기본 charge 탭에서는 history를 요청하지 않는다. `?tab=history`와 탭 클릭은 동일 흐름이다.
- 복원 중은 대기, 익명은 로그인 안내와 /login 이동 버튼을 표시하며 조회하지 않는다.
- history 탭 활성 상태에서 로그인/복원이 준비되면 page=1을 조회한다. useFocusEffect로 재진입/재포커스마다 새 목록을 불러오고 cleanup에서 이전 요청을 무효화한다.
- 상태는 PointsScreen 안에 둔다. 성공 목록/페이지/hasNext, 첫 로딩/오류, 추가 로딩/오류와 소유 user UUID·sessionVersion을 함께 관리한다.
- 렌더 시 현재 사용자·세션과 목록 소유자가 일치할 때만 행을 표시한다. effect 정리 전 렌더에서도 이전 계정 행을 노출하지 않는다.
- 요청은 generation과 user UUID/sessionVersion/활성 탭을 검사한다. blur/unmount/탭 변경/세션 변경 때 generation을 증가시켜 이전 성공·오류·finally가 새 요청 상태를 덮지 못하게 한다.
- inFlight ref로 같은 세대의 중복 요청을 막는다. 새 세대로 바뀌면 이전 pending 때문에 새 계정/탭의 요청이 차단되지 않게 한다.
- 다음 페이지는 마지막 성공 page+1이다. 실패 시 page를 올리지 않고 기존 목록을 유지해 같은 다음 page를 재시도한다. uuid로 중복을 제거하고 hasNext=false면 더 요청하지 않는다.
- 목록은 React Native FlatList의 안정적인 uuid 키로 표시한다. history에서는 Page scroll=false로 중첩 스크롤을 피하고 충전 탭의 기존 ScrollView 동작은 유지한다. API/세션 같은 구현 정보는 제품 문구에 넣지 않는다.
- 첫 로딩·빈 내역·첫 실패 재시도, 다음 로딩·실패 재시도·더 보기 상태를 실제 사용자 버튼/문구로 표시한다. getErrorMessage를 재사용한다.
- 다섯 거래 유형은 포인트 충전/광고 보상/회차 구매/관리자 조정/환불로 구분한다. amount는 +1,000 P/-30 P처럼 저장된 부호를 표시한다. 관리자 음수 조정을 양수로 만들지 않는다.
- 각 행에 거래 직후 잔액·일시를 표시한다. episode가 있으면 작품명과 N화를 표시하고 null이면 거래 유형만 사용한다. 숨겨진 거래를 버리거나 없는 제목을 추측하지 않는다.
- 날짜는 Intl.DateTimeFormat의 timeZone:'Asia/Seoul', hourCycle:'h23'로 2026.11.04 03:04 형태로 표시한다. 장치 local timezone/수동 +9시간 보정에 의존하지 않는다.
- 거래 응답의 balanceAfter를 현재 points로 쓰지 않는다. setPoints 호출 없이 상단 잔액은 기존 UserProvider.points를 그대로 표시한다.
- front/README.md의 현재 연결 상태 중 포인트 이용 내역·기존 회차 사용과 미제공 충전/광고/결제에 관련된 문장만 실제 상태에 맞춘다. 무관한 오래된 문서는 정비하지 않는다.

### 검증과 환경

- 위 선택 명령으로 요청/화면 신규 기능과 기존 episodePurchase/EpisodeUnlockDialog 회귀를 실행한다. 공통 모듈을 변경하지 않아 영향은 이 요청과 화면에 한정된다.
- 수동 확인은 기존 http://localhost:8081과 task-2에서 검증한 http://localhost:3000만 사용한다. 실제 서버가 없으면 자동 실행·다른 포트 우회 없이 수동 검증 실패/미실행을 명시한다.
- 필요한 실행 안내는 `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`다.
- 실제 API 데이터가 비어 있으면 화면의 빈 상태를 검증한다. 수동 화면 확인을 위해 기존 사용자에 포인트 지급·구매·seed를 실행하지 않는다.
- 최종 typecheck/전체 테스트/export는 `$finish-plan`에서 수행한다. 선택 테스트가 실패했거나 실행되지 않았으면 이 task를 완료하지 않는다.

### 반복 작업 위임

불가. 하나의 화면 상태·수명주기·표시 계약을 통합하는 작업으로 별도 설계 없는 반복 수정이 아니다. worker가 담당 네 파일을 직접 수정·통합·검증하고 하위 에이전트를 만들지 않는다.

### 주요 로직 코드 또는 변경 예시

요청/응답 및 표시 형식의 핵심 코드다. 타입 정의는 economyResponses.ts에 두며 pointHistory.ts는 이를 type import/re-export한다.

```typescript
// economyResponses.ts
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
export type PointHistoryPage = { items: PointHistoryItem[]; page: number; hasNext: boolean };

// pointHistory.ts
import { apiRequest } from '../user/sessionClient';
import type { PointHistoryPage } from './economyResponses';
export type { PointHistoryItem, PointHistoryPage, PointTransactionType } from './economyResponses';
export function getPointHistory(page = 1): Promise<PointHistoryPage> {
  return apiRequest<PointHistoryPage>(
    '/me/points/transactions?page=' + encodeURIComponent(page), { auth: 'required' },
  );
}

// PointsScreen.tsx local display helpers
const transactionLabels: Record<PointTransactionType, string> = {
  PURCHASE: '포인트 충전', AD_REWARD: '광고 보상', EPISODE_UNLOCK: '회차 구매',
  ADMIN_ADJUSTMENT: '관리자 조정', REFUND: '환불',
};
function formatHistoryTime(value: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}
function formatPointChange(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')} P`;
}
```

아래 상태/요청/호출 흐름은 PointsScreen 내부에 둔다. 기존 컴포넌트·스타일에 맞게 통합하되 guard 의미와 재시도 page를 유지한다. 별도 hook/provider로 추출하지 않는다.

```typescript
type HistoryState = {
  owner: string; version: number; items: PointHistoryItem[]; page: number; hasNext: boolean;
  status: 'loading' | 'loaded' | 'error'; error: unknown;
  nextLoading: boolean; nextError: unknown;
};

const { points, user, isRestoring, sessionVersion, isCurrentSession } = useUser();
const active = tab === 'history';
const owner = user?.uuid ?? null;
const [history, setHistory] = useState<HistoryState | null>(null);
const generation = useRef(0);
const inFlight = useRef(false);
const current = useRef({ owner, version: sessionVersion, active, isRestoring });
current.current = { owner, version: sessionVersion, active, isRestoring };

const loadPage = useCallback(async (
  page: number, replace: boolean, requestGeneration: number, version: number, userUuid: string,
) => {
  if (inFlight.current) return;
  const isCurrent = () => generation.current === requestGeneration && isCurrentSession(version)
    && current.current.owner === userUuid && current.current.version === version
    && current.current.active && !current.current.isRestoring;
  if (!isCurrent()) return;
  inFlight.current = true;
  if (replace) setHistory({ owner: userUuid, version, items: [], page: 0, hasNext: false,
    status: 'loading', error: null, nextLoading: false, nextError: null });
  else setHistory(value => value && { ...value, nextLoading: true, nextError: null });
  try {
    const result = await getPointHistory(page);
    if (!isCurrent()) return;
    setHistory(value => {
      const items = replace ? [] : [...(value?.items ?? [])];
      const seen = new Set(items.map(item => item.uuid));
      for (const item of result.items) {
        if (!seen.has(item.uuid)) { seen.add(item.uuid); items.push(item); }
      }
      return { owner: userUuid, version, items, page: result.page, hasNext: result.hasNext,
        status: 'loaded', error: null, nextLoading: false, nextError: null };
    });
  } catch (error) {
    if (!isCurrent()) return;
    setHistory(value => value && (replace
      ? { ...value, status: 'error', error }
      : { ...value, nextError: error }));
  } finally {
    if (isCurrent()) {
      inFlight.current = false;
      setHistory(value => value && { ...value, nextLoading: false });
    }
  }
}, [isCurrentSession]);

useFocusEffect(useCallback(() => {
  const requestGeneration = ++generation.current;
  inFlight.current = false;
  setHistory(null);
  if (active && owner && !isRestoring) {
    void loadPage(1, true, requestGeneration, sessionVersion, owner);
  }
  return () => { generation.current += 1; inFlight.current = false; };
}, [active, owner, isRestoring, sessionVersion, loadPage]));

const visibleHistory = active && history?.owner === owner && history.version === sessionVersion
  ? history : null;
const retryFirst = () => {
  if (active && owner && !isRestoring) void loadPage(1, true, generation.current, sessionVersion, owner);
};
const loadNext = () => {
  if (owner && visibleHistory?.status === 'loaded' && visibleHistory.hasNext && !visibleHistory.nextLoading) {
    void loadPage(visibleHistory.page + 1, false, generation.current, sessionVersion, owner);
  }
};
```

기존 charge UI를 유지하고 history의 상태 분기와 목록에 연결하는 주요 렌더 예시다. styles는 담당 PointsScreen 안에 필요한 행·footer 부분만 추가한다.

```tsx
const historyContent = isRestoring
  ? <EmptyState title="로그인 상태를 확인하고 있어요" description="잠시만 기다려 주세요." />
  : !owner
    ? <EmptyState title="로그인이 필요해요" description="포인트 이용 내역을 보려면 로그인해 주세요."
        action="로그인" onAction={() => router.push('/login')} />
    : !visibleHistory || visibleHistory.status === 'loading'
      ? <EmptyState title="이용 내역을 불러오는 중이에요" description="잠시만 기다려 주세요." />
      : visibleHistory.status === 'error'
        ? <EmptyState title="이용 내역을 불러오지 못했어요" description={getErrorMessage(visibleHistory.error)}
            action="다시 시도" onAction={retryFirst} />
        : visibleHistory.items.length === 0
          ? <EmptyState title="포인트 이용 내역이 없어요" description="포인트가 추가되거나 사용되면 이곳에 표시돼요." />
          : <FlatList data={visibleHistory.items} keyExtractor={item => item.uuid}
              renderItem={({ item }) => <View style={styles.historyRow}>
                <AppText weight="semibold">{transactionLabels[item.transactionType]}</AppText>
                {item.episode ? <AppText>{item.episode.dramaTitle} · {item.episode.episodeNumber}화</AppText> : null}
                <AppText>{formatPointChange(item.amount)}</AppText>
                <AppText>거래 후 잔액 {item.balanceAfter.toLocaleString('ko-KR')} P</AppText>
                <AppText>{formatHistoryTime(item.createdAt)}</AppText>
              </View>}
              ListFooterComponent={visibleHistory.nextLoading ? <AppText>더 불러오는 중이에요</AppText>
                : visibleHistory.nextError ? <View><AppText>{getErrorMessage(visibleHistory.nextError)}</AppText>
                    <Button label="다시 시도" onPress={loadNext} variant="secondary" /></View>
                  : visibleHistory.hasNext ? <Button label="더 보기" onPress={loadNext} variant="secondary" /> : null}
              style={styles.historyList} />;
```

기존 return의 Page는 `scroll={tab === 'charge'}`로 연결하고 history 분기에서 historyContent를 렌더한다. 복원 안내를 포함한 모든 제품 문구는 기존 화면과 같은 한국어로 작성한다. charge UI와 현재 잔액·뒤로 가기 header는 기존 표현을 유지한다.
