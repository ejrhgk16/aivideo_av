# 드라마 목록 공통 페이징과 프론트 연결

## 목표

GET /dramas를 기존 공통 30개 페이지 응답으로 전환하고 홈 최신·장르와 찾기 화면을 맞춘다. 찾기 검색은 전체 공개 작품을 대상으로 서버에서 수행한다. 범위와 공통 계약·task 구성은 각각 사용자 승인을 받았다. 이 계획 작성 단계에서는 제품 코드·테스트를 실행하거나 수정하지 않는다.

### 범위와 비목표

- 백엔드: 목록 페이징, 제목·장르명 검색, 장르 코드 필터, 정렬 동률 처리, API 문서와 기존 테스트 소비 코드.
- 프론트: API 타입·호출 함수, 홈 최신의 더 보기, 장르 API 사용, 찾기 서버 검색·더 보기·재시도·비동기 경합 처리, 관련 테스트.
- 회차·컬렉션 페이징, 다른 목록 API 개편, DB schema/migration, 전체 건수 조회, 전역 상태 추가, 라이브러리 교체는 범위 밖이다.
- 사용자 정정 반영: 기존 GET /genres를 프론트에서 연결한다. 장르 endpoint·응답·이미지 URL 생성은 변경하지 않는다.
- 목록·검색 상태는 각 화면 소유다. 기존 UserProvider와 sessionClient의 상태·인증 책임을 유지한다.
- 기존 도메인/화면/테스트 책임 안에서 작업한다. ARCHITECTURE.md에 정의된 계층 경계는 바꾸지 않는다.
- 작업은 dev에서 수행하며 branch/worktree를 만들거나 직접 commit/push하지 않는다. web-prototype/은 읽기·수정·검증 대상에서 제외한다.

## 공통 계약

### C1: 목록 REST와 백엔드 경계

정의 책임 task-2, 테스트 task-1, HTTP 소비 task-4, 프론트 테스트 task-3.

기존 back/src/common/pagination/paginationResponses.ts의 named type PageResponse<T>와 pagination.ts의 parsePage/getPageWindow/createPageResponse를 변경 없이 재사용한다.

```ts
// back/src/content/contentResponses.ts: named export
import type { PageResponse } from '../common/pagination/paginationResponses.js';
export type DramaPageResponse = PageResponse<DramaSummaryResponse>;

// back/src/content/publicCatalogService.ts: named exports
export type DramaListOptions = {
  page: number;
  q?: string;
  genre?: string;
};
export const DRAMA_PAGE_SIZE = 30;

// PublicCatalogService의 메서드: now의 구현 기본값은 new Date()
listDramas(
  options: DramaListOptions,
  now?: Date,
  userUuid?: string,
): Promise<DramaPageResponse>;

// back/src/content/publicCatalogController.ts: 메서드 경계
// query는 @Query(), request는 @Req(); request.user?.uuid만 사용자 선택에 사용
listDramas(
  query: Record<string, unknown>,
  request: AuthenticatedRequest,
): Promise<DramaPageResponse>;
```

- GET /dramas?sort=latest&page=1&q=검색어&genre=ROMANCE.
- sort 생략/단일 latest만 허용한다. page 생략 시 1, 양의 안전 정수 문자열만 허용한다. 기존 parsePage의 offset+lookahead 안전 범위·중복 값 거부를 그대로 따른다.
- q와 genre는 생략 또는 단일 문자열이다. trim한 빈 값은 조건 없음이다. 배열·객체 입력은 400이다. 알려지지 않은 장르 코드는 빈 결과다.
- q는 제목 또는 연결된 장르 이름의 대소문자 구분 없는 부분 검색이다. %, _, escape 문자도 일반 문자로 검색하도록 QueryBuilder parameter를 사용한다. genre는 장르 코드 필터이며 q와 AND로 결합한다. 다중 장르 작품이 중복되지 않아야 한다.
- 공개 조건(status=PUBLISHED, published_at <= now)을 적용하고 published_at DESC, id DESC로 정렬한다. DB에서 offset=(page-1)*30, limit=31로 조회한다.
- 공통 createPageResponse로 반환할 작품을 최대 30개로 자른 후, 그 작품들에 대해서만 회사·장르·이미지·프리뷰·공개 회차 수를 조회한다. 31번째 lookahead 작품의 관계는 보강하지 않는다.
- 응답 최상위 키는 items/page/hasNext만 존재한다. 항목의 기존 공개 필드는 그대로다. totalCount/totalPages/pageSize/data wrapper/내부 작품 ID를 추가하지 않는다.
- 빈 결과·범위 밖 페이지: 200과 { items: [], page: 요청 페이지, hasNext: false }. 잘못된 입력: 기존 공통 오류 형식 HTTP_BAD_REQUEST(400).
- 선택 JWT, 익명 프리뷰 isSaved=false, JWT 사용자별 isSaved, 잘못된 JWT의 401, userUuid query로 사용자 선택 불가를 보존한다.
- 페이지 사이 데이터 변경에 따른 offset 방식의 이동 가능성은 API 문서에 명시한다.
- 예: 31개 일치 -> page1 30개/true, page2 1개/false. 첫 페이지에 없는 작품의 제목/장르 검색도 독립적인 page1에서 발견한다.

검증: task-1의 drama-pagination 및 기존 content/소비 suite, task-2 checks, task-3의 API·UI 테스트.

### C2: 기존 장르 API 소비

기존 back/src/content/publicCatalogController.ts의 GET /genres와 contentResponses.ts의 GenreResponse는 이미 구현되어 있다. 프론트 연결은 task-4, 테스트는 task-3이 맡는다. 백엔드 장르 응답·이미지 처리·장르 API 문서는 변경하지 않는다.

```ts
// 현재 구현된 응답. 백엔드 타입 수정 대상이 아니다.
export type GenreResponse = DramaGenreResponse & {
  tileImage: string | null;
};
```

- GET /genres는 기존 displayOrder ASC 장르 전체 배열이며 인증이 필요 없다.
- tileImage는 기존 저장소 키다. 프론트에서 이를 API 서버 경로에 붙이거나 새 S3 URL 생성 규칙을 추가하지 않는다.
- 장르 목록은 GET /genres 전체 결과를 사용한다. 타일의 대표 이미지는 현재 불러온 작품 중 같은 장르 코드의 기존 posterLandscape 또는 poster URL을 재사용하고, 없으면 기존 placeholder를 표시한다. 이미지 유무로 장르를 제외하지 않는다.
- 찾기 화면의 장르 선택지도 GET /genres 전체 결과를 사용하므로 작품 첫 페이지에 없는 장르를 선택할 수 있다.

검증: task-3의 getGenres 호출·타입과 홈/찾기 RNTL 테스트. 기존 HTTP Genres 검사는 현재 응답 검증을 유지한다.

### C3: 프론트 API 호출과 타입

정의 책임 task-4, 작성 테스트 task-3. HomeScreen/SearchScreen이 호출 소비자다. back/src를 import하지 않는다.

```ts
// front/src/features/drama/dramaResponses.ts: 모두 named export
export type DramaListParams = {
  page?: number;
  q?: string;
  genre?: string;
};
export type DramaListPage = {
  items: DramaSummary[];
  page: number;
  hasNext: boolean;
};
export type GenreSummary = {
  id: number;
  code: string;
  name: string;
  tileImage: string | null;
};

// front/src/features/drama/dramaContent.ts: named export 및 위 타입 재export
export function getDramaList(params?: DramaListParams): Promise<DramaListPage>;
export function getGenres(): Promise<GenreSummary[]>;
```

- getDramaList() -> /dramas?sort=latest&page=1, auth:'optional'.
- query 순서는 sort, page, q, genre다. q/genre는 trim 후 비어 있지 않을 때만 URL encoding하여 추가한다.
- getDramaList({page:2,q:' 봄 ',genre:'ROMANCE'}) -> /dramas?sort=latest&page=2&q=%EB%B4%84&genre=ROMANCE.
- getGenres() -> /genres, auth:'public'. 두 함수 모두 기존 features/user/sessionClient.ts의 apiRequest를 사용하고 결과를 그대로 반환한다.
- 기존 getDramaContent와 DramaContent/DramaSummary export를 유지한다. 프론트의 다른 도메인 페이지 타입을 일괄 개편하지 않는다.
- HTTP 실패와 SessionChangedError는 기존 API client 계약을 따른다.

검증: dramaContent.test.ts의 URL·인증·응답·오류와 전체 프론트 회귀.

### C4: 화면 동작과 상태 소유

구현 책임 task-4, 테스트 책임 task-3. 새 공개 컴포넌트 props/테스트용 제품 export를 만들지 않는다.

- 각 화면이 items, 다음 페이지, hasNext, 최초/추가 로딩·오류, 요청 generation을 소유한다. 현재 sessionVersion과 isCurrentSession으로 응답 소유권을 확인한다.
- 공통으로 포커스 이탈·unmount·세션 변경·조건 변경 시 기존 요청을 무효화한다. 복원 중 목록 요청을 하지 않는다. 로그인 없이 공개 작품 조회는 가능하다.
- 최초/조건 재조회는 목록을 교체하고 page1로 초기화한다. 성공한 추가 페이지는 UUID 중복 없이 순서대로 붙인다. 다음 페이지 번호는 성공한 result.page+1이며 실패하면 같은 페이지를 재시도한다.
- 현재 추가 요청 중 더 보기의 중복 실행을 막는다. loading/error/empty를 구분한다. 최초 실패는 화면의 다시 시도, 추가 실패는 기존 목록을 보존하며 추가 영역의 다시 시도다.
- 추가 로딩은 '더 불러오는 중이에요', 추가 버튼은 접근성 button 이름 '더 보기'다. hasNext=false이면 추가 버튼을 숨긴다.
- 네트워크 요청 횟수는 이 계약의 트리거에 대해서만 검사한다. private effect 구조·내부 state setter 수를 테스트 계약으로 만들지 않는다.

HomeScreen:
- 포커스 시 기존 네 컬렉션 요청과 함께 getDramaList({page:1})과 getGenres()를 시작한다. 기본 추천 탭에서도 첫 페이지 prefetch를 유지한다. 두 응답은 서로 독립적이며 장르 실패로 최신 목록을 실패 처리하지 않는다.
- 최신 탭은 첫 페이지 items를 표시하고 더 보기로 page2 이상을 추가한다. 상세 이동은 기존 /drama/[id]와 uuid를 사용한다.
- 장르 목록은 GET /genres 전체 결과를 사용한다. 타일의 대표 이미지는 현재 불러온 작품 중 같은 장르 코드의 기존 posterLandscape 또는 poster URL을 재사용하고, 없으면 기존 placeholder를 표시한다. 이미지 유무로 장르를 제외하지 않는다. 최신 첫 페이지에 작품이 없는 장르도 표시한다. 장르 클릭은 /search?genre=장르코드로 이동한다.
- 기존 추천·랭킹·히어로·프리뷰 동작을 보존한다. 실패한 최신/장르 요청은 해당 영역에서 다시 시도하며 서로의 성공 결과를 지우지 않는다.

SearchScreen:
- 포커스 시 getGenres() 성공 후 현재 조건으로 page1을 요청한다. 장르 실패는 '장르를 불러오지 못했어요'와 다시 시도로 복구한다. 장르 준비 전 잘못된 무필터 작품 요청을 보내지 않는다.
- route genre는 기존처럼 code 또는 name을 받아 일치한 code로 정규화한다. 누락/모르는 route 값은 전체다. 필터 버튼의 표시명은 장르 name이며 선택 상태를 접근성 속성에 유지한다.
- 검색 입력 label은 기존 '작품 제목이나 장르 검색'이다. 입력 변경 후 300ms에 trim된 q를 적용한다. 장르 선택은 즉시 현재 입력값으로 page1을 요청하며 대기 중 debounce를 무효화한다.
- 입력 변경 순간 이전 조건의 목록을 현재 결과로 보이지 않게 하고 이전 요청을 무효화한다. 300ms 전에는 새 검색 요청을 하지 않는다. 공백 차이만 있는 동일 유효 조건은 불필요한 요청을 하지 않는다.
- 목록 상태 소유권에는 세션·유효 검색 조건이 포함된다. 포커스 복귀·재시도 시 검색 입력과 선택 장르는 유지한다.
- 서버 items를 다시 로컬 제목/장르 필터로 거르지 않는다. '모든 작품 보기'는 입력을 비우고 전체 장르로 page1을 다시 조회한다.
- 개수 표시는 성공한 현재 조건의 중복 제거 목록 기준 '불러온 작품 N개'다. total count로 표현하지 않는다.
- 첫 페이지 로딩/실패/빈 결과 문구는 기존 '작품을 불러오는 중', '작품을 불러오지 못했어요', '아직 찾는 이야기가 없어요'를 유지한다.

검증: searchScreen/homeScreen RNTL, savedVideoScreens 기존 홈 프리뷰·저장 회귀.

### C5: 테스트 소비 코드와 fixture

작성 책임 task-1, 제품 구현 후 실행/문서 책임 task-2. 테스트 전용 helper를 제품 코드에서 import하지 않는다.

- 기존 목록 호출 소비 컬렉션은 content/programming/playback/economy/watch-progress/saved-videos 6개다. 응답을 배열로 가정하는 checkResponseRoot, 목록 선택·비교, catalog 변수 저장, pm.sendRequest 경로도 확인한다.
- 'Latest dramas' 첫 응답은 C1의 page shape를 검사한다. 이후 hasNext를 따라 전 페이지를 읽고 기존 fixture 선택·컬렉션 정합성 검사에 사용한다. 첫 페이지에 적합한 작품이 없어도 실패로 단정하지 않는다. 각 추가 요청도 HTTP status/metadata/항목 계약을 검사한다.
- JSON을 런타임에 주입·약화하지 않고 suite별 정적 컬렉션을 수정한다. pm.sendRequest에는 collection event가 적용되지 않으므로 응답을 직접 검사한다.
- 새 back/test/api/catalogPages.mjs의 named helper 경계는 아래다. run.mjs의 기존 3곳 준비용 목록 조회가 사용하고, Vitest는 ../../api/catalogPages.mjs에서 import한다.

```js
// JSDoc: baseUrl:string, fetcher:typeof fetch,
// 반환: Promise<import('../../src/content/contentResponses.js').DramaSummaryResponse[]>
export async function readCatalogPages(baseUrl, fetcher = fetch) {
  const items = [];
  const seen = new Set();
  for (let page = 1; ; page += 1) {
    const url = baseUrl.replace(/\/+$/, '') + '/dramas?sort=latest&page=' + page;
    const response = await fetcher(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Catalog HTTP request failed.');
    const body = await response.json();
    if (!body || !Array.isArray(body.items) || body.page !== page ||
        typeof body.hasNext !== 'boolean' || body.items.length > 30 ||
        (body.hasNext && body.items.length !== 30)) {
      throw new Error('Invalid catalog page.');
    }
    for (const item of body.items) {
      if (!item || typeof item.uuid !== 'string' || seen.has(item.uuid)) {
        throw new Error('Invalid or duplicate catalog item.');
      }
      seen.add(item.uuid);
      items.push(item);
    }
    if (!body.hasNext) return items;
  }
}
```

- helper는 page1부터 순차 조회하고 items를 합친다. non-2xx, 잘못된 items/page/hasNext, 요청 페이지와 다른 page, 30개 초과, hasNext=true인데 30개 미만인 응답, 중복 UUID는 실패다. HTTP timeout은 기존 10초다. 잘못된 응답을 빈 결과로 처리하지 않는다.
- 새 drama-pagination suite는 content 바로 다음 순서로 등록하고 contentMode='exclusive'를 쓴다. 기존 content는 shared를 유지한다. 무인자 실행은 기존 10개에 신규 1개를 더한 11개 suite다.
- 신규 컬렉션은 Root, Login as entitled fixture user, Login as unentitled fixture user를 포함해 기존 suiteSelection 규약을 따른다.
- fixture는 createFixtureContext의 실행별 사용자 두 명과 기존 공개 작품의 회사만 template으로 사용한다. 기존 공개 작품·장르·미디어·컬렉션을 변경하지 않는다.
- 공개 작품 31개는 같은 공개 시각으로 만들고 실제 내부 id DESC로 기대 UUID 배열을 계산한다. q 전용 실행별 제목 prefix로 31건, 그 중 30건만 매칭하는 별도 제목 조건, 0건 조건을 만든다. 이 31건 조건의 page2에 있는 작품의 고유 제목 검색도 검사한다.
- 실행 전용 장르 두 개와 다중 장르 작품, 프리뷰, 숨김·미래·미지정 공개 시각 작품을 소유 fixture로 만든다. 신규 장르 id는 smallint 범위 내의 빈 값만 사용한다.
- 대소문자·공백·%, _, escape 문자 검색, 장르명 단독 검색, q+genre, 없는 장르, 잘못된/중복/객체 입력과 페이지 경계를 검사한다.
- 프리뷰 저장은 기존 PUT/DELETE API로 실행 사용자만 변경한다. 익명·사용자 A·사용자 B의 isSaved를 대조하고 삭제/cleanup을 검증한다.
- UUID/장르 id를 삽입 전에 기록하고 finally에서 소유 사용자 상태 -> 관계/영상/이미지 -> 작품/장르 순으로 정리한다. 부분 setup/cleanup 실패는 원래 오류를 보존하며 실패다. 소유 데이터 잔여 여부도 검사한다.
- 신규 fixture 생성·Postman·cleanup 전체에 exclusive lock을 유지한다. seed·서버 자동 실행·전체 DB 삭제는 하지 않는다.
- 기존 외부 API_TEST_ENVIRONMENT_FILE 경로는 DB fixture를 자동 생성하지 않는다. 신규 suite에 필요한 값과 정리 책임을 back/README.md에 기록한다. 기본 로그인 변수는 기존 이름을 재사용하고, 추가 값의 환경 키는 다음 표로 고정한다.

| 환경 키 | 값 |
| --- | --- |
| catalogAllQuery | 공개 소유 작품 31개를 매칭하는 제목 prefix |
| catalogThirtyQuery | 소유 공개 작품 중 정확히 30개를 매칭하는 제목 조건 |
| catalogEmptyQuery | 어떤 공개 작품도 매칭하지 않는 조건 |
| catalogTailQuery | 기본 31건 결과의 두 번째 페이지 작품 1개를 매칭하는 제목 조건 |
| catalogLiteralQuery | %, _, escape 문자를 포함한 literal 제목 조건 |
| catalogGenreCodeA / catalogGenreCodeB | 실행 전용 장르 코드 두 개 |
| catalogGenreName | 제목에 포함되지 않은 장르 A의 이름 |
| catalogExpectedUuids | 공개 31개 UUID의 정렬된 JSON 배열 |
| catalogThirtyExpectedUuids | 30건 조건의 정렬된 UUID JSON 배열 |
| catalogGenreExpectedUuids | allQuery+genre B 교집합의 정렬된 UUID JSON 배열 |
| catalogLiteralExpectedUuids | literal 조건의 UUID JSON 배열 |
| catalogExcludedUuids | 숨김/미래/undated 작품 UUID JSON 배열 |
| catalogPreviewVideoUuid / catalogPreviewDramaUuid | 저장 상태 검사 대상 공개 프리뷰와 부모 작품 |

- 이 환경 값은 자격 증명과 함께 전용 임시 환경에만 기록한다. 토큰·비밀번호·서명 URL을 로그·저장소에 남기지 않는다.
- 신규 fixture helper 내부 함수는 task-1 소유다. run.mjs 통합과 fixture tests를 같은 task가 맡으며 helper의 private 구조를 제품 계약으로 추가하지 않는다.

### C6: 테스트 도구와 관찰 경계

task-1/task-2: 설치 Vitest 4.1.11, Postman CLI와 기존 run.mjs/fixtureContext/contentLock을 사용한다. HTTP에서 안전하게 관찰 가능한 C1은 Postman이 주 검사이며, helper 통신 오류와 부분 fixture 실패·기존 service 단위 회귀만 Vitest로 다룬다.

task-3/task-4: 설치 Jest 29.7.0, jest-expo 57.0.6, React 19.2.3, React Native 0.86.3, RNTL 13.3.3, Expo Router 57.0.20을 사용한다. front/package-lock.json과 실제 export를 기준으로 하며 업그레이드하지 않는다.

- 프론트 작성 시 .agents/skills/react-native-testing/SKILL.md, references/api-reference-v13.md, references/expo.md, javascript-typescript-jest/SKILL.md를 따른다.
- 실제 화면과 공용 UI를 렌더링하고 API 경계 @/features/drama/dramaContent, @/features/home/homeContent와 기존 @/features/user/UserProvider mock을 사용한다. sessionClient 통합 API 테스트는 기존 configureSessionClient와 fetch 경계로 검사한다.
- Router 포커스/blur는 expo-router/testing-library의 renderRouter/testRouter와 실제 Stack을 사용한다. 테스트를 위해 제품 props/exports를 만들지 않는다.
- userEvent 입력, fake timer 300ms, deferred 응답의 시작/완료 순서, findByRole/label을 사용한다. 기존 front/tests/setup.ts의 cleanup과 환경 복구를 재사용하고 경고를 숨기지 않는다.
- 초기 복원 중 -> 복원 완료 -> page1 성공 -> page2 실패/재시도 -> 조건 변경 -> 이전 page2 완료 등의 이벤트 순서를 명시한다. 이전 세션·이전 조건의 응답이 최신 화면에 들어오지 않음을 검사한다.
- 첫 페이지 이후 작품/장르가 존재하는 테스트 데이터로 첫 페이지 잘림을 탐지한다. mock이 반환한 서버 결과를 다시 로컬 필터링하지 않음도 검사한다.
- 새 homeScreen 테스트와 기존 savedVideoScreens 테스트의 역할을 분리하되 후자의 저장·프리뷰 이동 시나리오를 삭제하거나 약화하지 않는다.

## Task

| 번호 | 문서 | 수정 파일 | 핵심 작업 |
| --- | --- | --- | --- |
| 1 | task-1-backend-tests.md | index.json task-1.files 15개 | 미래 계약 테스트·HTTP 소비 코드·fixture·실행기 |
| 2 | task-2-backend-source.md | index.json task-2.files 6개 | 공통 페이징·필터·문서와 실제 검증 |
| 3 | task-3-frontend-tests.md | index.json task-3.files 4개 | 프론트 API·검색·홈 테스트와 기존 mock 적응 |
| 4 | task-4-frontend-source.md | index.json task-4.files 4개 | API 타입·호출·홈·검색 구현과 실행 |

정확한 수정 파일·depends_on·checks는 각 task 문서에 index.json과 같은 내용으로 기재한다. 기존 작업자의 변경을 되돌리지 않으며 각 worker는 자신의 files 안에서 apply_patch로만 수정한다. 테스트 결함은 소스 worker가 범위 밖에서 고치지 않고 부모에게 근거를 보고한다.

## 실행 순서 및 병렬 작업

- task-1과 task-3은 선행 조건이 없고 수정 파일·출력·fixture가 겹치지 않아 병렬 작성 가능하다. 둘 다 미래 기능 테스트 작성 역할이며 behavioral test를 실행하지 않는다.
- task-2는 task-1 완료 후 실행한다. task-3과는 파일과 검증 출력이 독립적이어서 병렬 가능하다.
- task-4는 task-2와 task-3 완료 후 실행한다. API 클라이언트 타입 변경과 두 화면 변경을 한 task에 넣어 중간 상태의 typecheck 실패를 피한다.
- 메인을 제외한 동시 worker는 최대 2명, 예약 child 슬롯 0개다. 모든 task에서 반복 작업의 하위 위임은 불가하다. 테스트마다 계약·fixture·비동기 판단이 연결되어 단순 반복 패턴으로 분리하지 않는다.
- 새 API suite는 exclusive lock, 기존 content reader는 shared lock을 유지한다. 각 task의 HTTP 검사는 조정 밖에서 겹쳐 실행하지 않는다.
- 이번 호출은 계획 작성까지만 수행한다. 사용자가 명시적으로 $harness를 호출해야 worker를 배정한다.

## 검증과 성공 기준

- task-1: node --check 4개와 변경 컬렉션 JSON 파싱. imports·계약·시나리오 검토 후 완료 가능하며 기능 통과를 의미하지 않는다.
- task-3: checks=[]; 미래 API와 화면 동작을 대상으로 정적 검사·타입검사·동작 실행을 강요하지 않는다. imports/mock/fixture/이벤트 순서와 계약 검토 결과를 task-4에 전달한다.
- task-2: lint, content+drama-pagination 선택 실행, test(전체 Vitest와 전체 HTTP suite), test:api:parallel, build 통과. 실행기 변경 때문에 선택/무인자 경로 모두 필요하다. 6개 컬렉션과 fixture 초기화가 영향을 받아 백엔드 전체 회귀를 선택한다.
- task-4: typecheck, 관련 4개 테스트 선택 실행, 전체 front test 통과. 두 화면의 auth/focus 소비와 기존 mock을 포함하므로 전체 프론트 회귀도 필요하다.
- task-2/4는 모든 checks를 실제 실행하고 통과해야 완료한다. 미실행/서버 부재/fixture 부족/cleanup 실패는 성공으로 보고하지 않는다.
- 백엔드 HTTP 검사는 현재 코드가 반영된 기존 http://localhost:3000과 같은 개발 MySQL에서 실행한다. 서버가 없으면 실패로 보고하고 npm --prefix back run start:dev 실행을 안내한다. 자동 시작/다른 포트는 금지한다. UI 수동 확인을 추가할 경우 기존 http://localhost:8081만 사용한다.
- finish는 별도 $finish-plan 호출에서 front typecheck/test/export, back lint/test/build 및 별도 test:api:parallel을 공통 규칙에 따라 검증한다.

