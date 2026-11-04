# task-4-frontend-source

## 기본 입력

- 이 문서와 index.json task-4 항목, 전달된 적용 지침, task-2와 task-3 완료 요약.
- depends_on: [task-2,task-3]. 서버 계약과 선행 테스트 작성이 완료된 후 시작한다.
- 다른 작업자와 저장소를 공유한다. 타인의 변경을 되돌리지 않으며 자신의 files 안에서 apply_patch로만 수정한다.

## 읽어야 할 파일

- 아래 수정 파일 4개: 실제 API 요청·응답 타입, HomeScreen의 catalog/탭/기존 컬렉션, SearchScreen의 상태·복원·focus·검색·장르 처리.
- front/src/features/user/sessionClient.ts의 apiRequest, common/http/api.ts의 SessionChangedError, UserProvider.tsx의 useUser/isCurrentSession 계약.
- front/src/features/home/homeContent.ts와 homeResponses.ts의 기존 컬렉션 계약.
- front/src/common/media.ts의 resolveApiImageUrl, components/ui.tsx의 Button/EmptyState/Page 공개 props.
- front/src/screens/LibraryScreen.tsx의 loadPage·generation/inFlight·추가 실패 복구 패턴만 참고한다. 공용 hook으로 추출하지 않는다.
- front/README.md의 전역 상태·검증, package.json의 스크립트.
- task-2 요약의 C1/C2 서버 동작·검증 결과와 task-3 요약의 타입/mock/시나리오를 읽는다. 실행만을 위해 테스트 파일 전체를 읽을 필요는 없다.

## 필요 시 참고할 문서

- 루트 AGENTS.md가 누락되거나 변경된 경우에만 원문을 확인한다.
- 파일 책임·전역 상태 경계 변경이 필요하다고 판단한 경우에만 _docs/ARCHITECTURE.md의 Frontend/Boundaries 및 front/README.md의 전역 상태를 확인한다. 이 계획은 화면 로컬 상태를 유지한다.
- 계약이 누락·충돌한 경우에만 같은 폴더 plan.md의 해당 C1~C6 절을 확인한다. 전체 plan 재독을 요구하지 않는다.
- 역할/상태 규칙이 누락된 경우에만 _docs/plans/README.md의 관련 절을 확인한다.

## 실패 시 참고할 파일

- front/tests/unit/dramaContent.test.ts: HTTP URL·response/auth 실패.
- front/tests/unit/searchScreen.test.tsx: debounce·장르·page·focus/session 경합 실패.
- front/tests/unit/homeScreen.test.tsx: 최신/장르·추가 페이지·오류·세션 실패.
- front/tests/unit/savedVideoScreens.test.tsx: 기존 홈 프리뷰·저장 회귀.
- RNTL 경고/타이머/Router 실패 시 front/tests/setup.ts와 .agents/skills/react-native-testing/references/api-reference-v13.md, references/expo.md 및 javascript-typescript-jest/SKILL.md의 해당 부분.
- 이 task는 테스트 파일을 수정할 수 없다. 테스트 결함이면 부모에게 계약·입력·최초 오류를 보고하고 assertion을 약화하지 않는다.

## 작업

### 역할과 완료 조건

제품 소스 구현·실행 역할이다. C3/C4를 구현하고 아래 checks를 모두 통과해야 완료한다. API 클라이언트 타입과 Home/Search 두 화면을 같은 task에서 수정해 중간 배열/page 불일치를 해소한다. 상태를 전역화하거나 기존 UI의 무관한 부분을 수정하지 않는다.

### 수정 허용 파일

```text
front/src/features/drama/dramaContent.ts
front/src/features/drama/dramaResponses.ts
front/src/screens/HomeScreen.tsx
front/src/screens/SearchScreen.tsx
```

### Checks

```powershell
npm --prefix front run typecheck
npm --prefix front run test -- tests/unit/dramaContent.test.ts tests/unit/searchScreen.test.tsx tests/unit/homeScreen.test.tsx tests/unit/savedVideoScreens.test.tsx
npm --prefix front run test
```

### 적용 계약

C3 정의 책임:
```ts
// front/src/features/drama/dramaResponses.ts: named exports
export type DramaListParams = { page?: number; q?: string; genre?: string };
export type DramaListPage = { items: DramaSummary[]; page: number; hasNext: boolean };
export type GenreSummary = {
  id: number;
  code: string;
  name: string;
  tileImage: string | null;
};
// front/src/features/drama/dramaContent.ts: named exports 및 타입 재export
export function getDramaList(params?: DramaListParams): Promise<DramaListPage>;
export function getGenres(): Promise<GenreSummary[]>;
```

- getDramaList() -> /dramas?sort=latest&page=1, auth:'optional'. q/genre trim 후 빈 값 생략, sort/page/q/genre 순서와 URL encoding.
- getGenres() -> /genres, auth:'public'. page/genre 결과를 변환 없이 반환하고 기존 apiRequest·오류/SessionChangedError를 재사용한다.
- 기존 DramaContent/DramaSummary/getDramaContent는 유지한다. back 소스 import와 타 도메인 페이지 타입 일괄 수정은 하지 않는다.
- C1 서버는 필터 후 최대30 items/page/hasNext를 반환한다. C2는 기존 장르 응답이며 tileImage는 저장소 키다.

C4 구현 책임:
- 각 화면에 목록/추가 페이지/hasNext/최초·추가 로딩·오류/generation을 소유한다. sessionVersion/isCurrentSession과 조건 소유권이 일치한 응답만 적용한다.
- blur/unmount/세션/조건 변경으로 이전 요청을 무효화하고 복원 중 목록 요청을 하지 않는다. 포커스 복귀 시 현재 조건 page1을 교체 조회한다.
- 더 보기는 중복 실행 방지, 성공한 result.page+1, UUID 중복 없는 append, hasNext=false 숨김이다. 추가 실패는 기존 목록을 유지하고 같은 page를 재시도한다.
- 추가 button 이름 '더 보기', 로딩 '더 불러오는 중이에요', 실패의 '다시 시도'.
- Home 포커스는 기존 네 컬렉션+getDramaList({page:1})+getGenres()를 독립 시작한다. 추천 탭 prefetch 유지. 최신 목록과 장르 실패/재시도 상태를 독립 관리한다.
- Home의 장르 목록은 GET /genres 전체 결과를 사용한다. 타일의 대표 이미지는 현재 불러온 작품 중 같은 장르 코드의 기존 posterLandscape 또는 poster URL을 재사용하고, 없으면 기존 placeholder를 표시한다. 이미지 유무로 장르를 제외하지 않는다. 클릭 -> /search?genre=code. 기존 추천/랭킹/프리뷰/상세 이동을 보존한다.
- Search는 getGenres 성공 후 현재 조건 page1, genre 준비 실패 문구 '장르를 불러오지 못했어요'/다시 시도다. route genre는 code/name -> code, unknown/누락 -> 전체다.
- Search 입력 label '작품 제목이나 장르 검색', 300ms debounce다. 입력 조건 변경 즉시 이전 목록을 숨기고 요청 무효화한다. 장르 선택은 현재 입력값으로 즉시 page1을 조회하고 pending debounce를 취소한다. trim 후 동일 조건은 불필요한 요청을 하지 않는다.
- 검색 입력/선택 장르는 focus·재시도 시 유지하고 서버 items에 로컬 필터를 재적용하지 않는다. '모든 작품 보기'는 조건 초기화 후 page1이다.
- 성공한 현재 목록의 개수는 '불러온 작품 N개'. 기존 '작품을 불러오는 중'/'작품을 불러오지 못했어요'/'아직 찾는 이야기가 없어요' 문구를 보존한다.

C6 검증 도구:
Jest29.7.0/jest-expo57.0.6/RNTL13.3.3/Router57.0.20과 기존 setup을 사용한다. 테스트는 API 경계만 mock하고 실제 화면을 렌더링한다.

### 구현 지시

1. dramaResponses.ts에 새 타입을 추가하고 dramaContent.ts에서 재export한다. getDramaList 기본 page1과 q/genre encoding, getGenres public 호출을 구현한다.
2. Home은 catalog 배열만 기대하던 부분을 page state로 바꾸고 최신 영역의 더 보기/오류/재시도를 추가한다. 장르 추출용 catalog.flatMap은 getGenres 결과로 바꾼다.
3. Search는 서버 조회 상태로 전환한다. 장르 준비/route 정규화, 현재 draft 입력과 적용 조건, debounce 수명, 최초/추가 요청 수명을 구별한다.
4. 새로운 조건/세션으로 넘어간 이전 finally가 최신 inFlight/loading 상태를 지우지 않도록 generation으로 완료 처리도 보호한다.
5. 응답 배열을 전체 모아 반환하는 편법을 쓰지 않는다. 필요한 페이지를 사용자 동작에 따라 요청하며 기존 화면의 카드·navigation·접근성을 유지한다.
6. 선택 검사 후 전체 front test를 실행한다. 실제 UI 네트워크 확인을 추가할 경우 기존 8081/3000만 사용하며 서버를 자동 시작하지 않는다. 제품 검증 미실행을 통과로 보고하지 않는다.

### 주요 로직 코드 또는 변경 예시

API 구현 기준:

```ts
export function getDramaList(params: DramaListParams = {}): Promise<DramaListPage> {
  let path = '/dramas?sort=latest&page=' + encodeURIComponent(params.page ?? 1);
  const q = params.q?.trim();
  const genre = params.genre?.trim();
  if (q) path += '&q=' + encodeURIComponent(q);
  if (genre) path += '&genre=' + encodeURIComponent(genre);
  return apiRequest<DramaListPage>(path, { auth: 'optional' });
}
export function getGenres(): Promise<GenreSummary[]> {
  return apiRequest<GenreSummary[]>('/genres', { auth: 'public' });
}
```

아래는 화면 내부 요청 흐름의 기준 예시다. private 이름을 새 공개 export로 만들지 않는다. queryOptions는 현재 화면의 정규화된 q/genre이고, Search의 getGenres 준비와 debounce가 끝난 후에만 loadPage를 호출한다.

```tsx
async function loadPage(page: number, replace: boolean) {
  if (inFlight.current || isRestoring) return;
  inFlight.current = true;
  const requestGeneration = generation.current;
  const version = sessionVersion;
  const isCurrent = () =>
    generation.current === requestGeneration && isCurrentSession(version);
  if (replace) {
    setItems([]);
    setStatus('loading');
    setError(null);
  } else {
    setNextLoading(true);
  }
  setNextError(null);
  try {
    const result = await getDramaList({ page, ...queryOptions });
    if (!isCurrent()) return;
    setItems((current) => {
      if (!isCurrent()) return current;
      if (replace) return result.items;
      const merged = [...current];
      const seen = new Set(current.map((item) => item.uuid));
      for (const item of result.items) {
        if (seen.has(item.uuid)) continue;
        seen.add(item.uuid);
        merged.push(item);
      }
      return merged;
    });
    nextPage.current = result.page + 1;
    setHasNext(result.hasNext);
    setStatus('loaded');
  } catch (error) {
    if (!isCurrent() || error instanceof SessionChangedError) return;
    if (replace) { setStatus('error'); setError(error); }
    else setNextError(error);
  } finally {
    if (isCurrent()) {
      inFlight.current = false;
      setNextLoading(false);
    }
  }
}
```

새 세션/포커스/조건의 최초 요청을 시작하기 전에 generation을 증가시키고 이전 목록·hasNext·오류·inFlight·nextPage를 초기화한다. blur cleanup도 generation을 증가시켜 오래된 완료를 차단한다. Search의 추가 요청에는 현재 조건을 유지한다. 이 private 요청 흐름을 재사용하기 위한 새 hook/API를 추가하지 않는다.

검색 이벤트 기준:
- 입력 draft trim값이 달라지면 즉시 generation/표시 소유권을 무효화하고 timer를 재설정한다.
- 300ms 뒤 현재 draft가 적용 조건이 되면 page1을 조회한다.
- 장르 클릭은 timer를 취소하고 현재 draft trim과 새 code를 한 조건으로 적용하여 page1을 즉시 조회한다.
- 장르 준비/focus 복귀 시에도 현재 조건만 조회하고 이전 timer/응답을 재사용하지 않는다.

### 반복 작업 위임

불가. API·검색·홈 상태가 함께 전환되어 단순 반복 수정이 아니다. child 슬롯0. task-2/task-3이 모두 완료된 후 단독 소스 통합·검증한다.

