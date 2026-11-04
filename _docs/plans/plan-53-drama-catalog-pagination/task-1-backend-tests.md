# task-1-backend-tests

## 기본 입력

- 이 task 문서와 index.json task-1 항목, 전달된 적용 지침.
- depends_on: []. 선행 제품 구현은 없다. 아래 코드는 승인된 미래 인터페이스를 대상으로 한다.
- 다른 작업자도 같은 저장소를 사용한다. 자신의 files 외 파일과 다른 작업자의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- 아래 수정 허용 파일 중 기존 6개 Postman 컬렉션: Genres/Latest dramas, 공통 response checker, catalog 변수와 이후 fixture 선택·비교 구간.
- back/test/api/run.mjs: 환경 선택·suite 실행·lock 획득·3곳 catalog 준비 조회·fixture finally 정리.
- back/test/api/suites.mjs 및 back/test/unit/api/suiteSelection.spec.ts: 선택·순서·collection 이름·lock 검사.
- back/test/unit/content/publicCatalogService.spec.ts: 목록 공개 회차 수, controller optional identity의 현재 시그니처 의존 구간.
- back/src/content/publicCatalogController.ts, publicCatalogService.ts: 목록·장르 진입점/QueryBuilder/기존 매핑. contentResponses.ts의 공개 항목 타입.
- back/src/common/pagination/pagination.ts, paginationResponses.ts: 실제 기존 export.
- back/test/api/fixtureContext.mjs의 createUser/cleanup 및 contentLock.mjs의 acquireContentLock 계약.
- back/test/api/watchHistoryFixtures.mjs, back/test/unit/api/watchHistoryFixtures.spec.ts: 삽입 전 소유권 기록·부분 실패 정리 패턴만.
- back/src/content/entities/{genre,dramaGenre,drama,contentImage,contentVideo}.entity.ts: fixture 필수 열·키·종류·smallint 범위.
- back/package.json·package-lock.json의 테스트 도구와 back/README.md의 검증/API suite/기본 데이터·fixture/외부 Postman 환경 절.

## 필요 시 참고할 문서

- 루트 AGENTS.md가 전달되지 않았거나 변경된 경우에만 해당 원문을 확인한다.
- 파일 책임·계층 경계를 바꿔야 한다고 판단한 경우에만 _docs/ARCHITECTURE.md의 Backend/Frontend 및 Boundaries를 확인한다. 승인 범위 밖 변경이면 부모에게 보고한다.
- 아래 계약에 누락·충돌이 있을 때만 같은 폴더 plan.md의 명시한 계약 섹션을 확인한다. 전체 plan 재독은 필수가 아니다.
- 역할/상태/검증 규칙이 누락된 경우에만 _docs/plans/README.md의 해당 절을 확인한다.

## 실패 시 참고할 파일

- 이 작성 task에서는 행동 검사를 실행하지 않는다. 정적 검사 실패는 해당 수정 파일을 확인한다.
- task-2가 테스트 결함을 보고한 경우 해당 테스트/fixture와 계약 C1/C2/C5/C6만 대조하고 부모의 재배정 절차를 따른다.

## 작업

### 역할과 완료 조건

미구현 기능의 테스트 작성 역할이다. 제품 코드를 변경하지 않는다. HTTP 컬렉션·fixture·실행기·필요 단위 테스트를 작성한 후 아래 정적 checks와 계약/시나리오 검토로 완료한다. 예상 실패 행동 실행도 하지 않는다. 완료 요약은 C1/C2/C5/C6, 작성 시나리오, fixture 환경 값, 실제 정적 검사 결과, task-2가 실행할 검사와 검토상 제약을 포함한다.

### 수정 허용 파일

```text
back/test/api/content.postman_collection.json
back/test/api/programming.postman_collection.json
back/test/api/playback.postman_collection.json
back/test/api/economy.postman_collection.json
back/test/api/watch-progress.postman_collection.json
back/test/api/saved-videos.postman_collection.json
back/test/api/drama-pagination.postman_collection.json
back/test/api/catalogPages.mjs
back/test/api/dramaPaginationFixtures.mjs
back/test/api/run.mjs
back/test/api/suites.mjs
back/test/unit/api/catalogPages.spec.ts
back/test/unit/api/dramaPaginationFixtures.spec.ts
back/test/unit/api/suiteSelection.spec.ts
back/test/unit/content/publicCatalogService.spec.ts
```

### Checks

```powershell
node --check back/test/api/catalogPages.mjs
node --check back/test/api/dramaPaginationFixtures.mjs
node --check back/test/api/run.mjs
node --check back/test/api/suites.mjs
node -e "const fs=require('node:fs'); for (const name of ['content','programming','playback','economy','watch-progress','saved-videos','drama-pagination']) JSON.parse(fs.readFileSync('back/test/api/'+name+'.postman_collection.json','utf8'))"
```

### 적용 계약

C1:
```ts
// back/src/content/contentResponses.ts: named export
export type DramaPageResponse = PageResponse<DramaSummaryResponse>;
// back/src/content/publicCatalogService.ts: named exports
export type DramaListOptions = { page: number; q?: string; genre?: string };
export const DRAMA_PAGE_SIZE = 30;
// PublicCatalogService
listDramas(options: DramaListOptions, now?: Date, userUuid?: string): Promise<DramaPageResponse>;
// PublicCatalogController: @Query()와 @Req()
listDramas(query: Record<string, unknown>, request: AuthenticatedRequest): Promise<DramaPageResponse>;
```

- page 기본 1/30개/기존 parsePage, sort 생략 또는 latest. q/genre는 trim한 단일 문자열, 빈 값은 조건 없음, 배열·객체는 400이다.
- q는 제목 OR 장르명 부분 검색(대소문자 미구분, %, _, escape 문자 literal), genre는 코드 필터다. 조건은 페이징 전에 AND로 결합하며 다중 장르 작품은 중복되지 않는다.
- PUBLISHED·publishedAt<=now, published_at DESC/id DESC, offset/31개 lookahead, 최대 30개 관계 보강.
- 응답은 items/page/hasNext만, 빈 페이지는 200/[]/false, 기존 항목 필드·오류·optional JWT와 사용자 격리를 유지한다.
- controller identity 회귀는 listDramas({}, request) -> service.listDramas({page:1}, undefined, request.user.uuid)로 적응한다.

C2: GET /genres는 기존 { id, code, name, tileImage } 전체 배열이다. tileImage는 저장소 키이며 endpoint·응답·이미지 코드는 변경하지 않는다. 기존 Genre 검사는 그대로 유지한다. 새로운 getGenres 연결과 타일은 task-3/task-4 담당이다.

C6 도구는 설치 Vitest 4.1.11/Postman CLI다. Jest API를 Vitest에 복사하지 않는다. HTTP로 가능한 C1 계약은 Postman을 주 검사로 둔다.

C5의 named test helper:
```js
// back/test/api/catalogPages.mjs
// JSDoc 반환: Promise<import('../../src/content/contentResponses.js').DramaSummaryResponse[]>
export async function readCatalogPages(baseUrl, fetcher = fetch)
```

이 마지막 블록은 JS 함수의 외부 시그니처만 나타낸다. 실제 함수 본문은 이 task에서 구현한다. run.mjs가 3곳 준비 조회에서 사용하며 Vitest는 ../../api/catalogPages.mjs를 import한다. page1부터 hasNext까지 합치고 HTTP/shape/page/크기/중복 오류와 timeout을 실패로 처리한다.

### 구현 지시

1. 기존 6개 컬렉션의 첫 응답을 page object로 적응한다. 최초 page 검사와 후속 전 페이지 순회를 모두 수행한 결과로 기존 fixture를 선택한다. 기존 항목·인증·공개·컬렉션 정합성 검사를 삭제하지 않는다. 기존 장르 응답 검사는 유지한다.
2. pm.sendRequest의 후속 페이지에는 status와 C1 shape·항목 검사를 직접 적용한다. HTTP 실패나 malformed body를 빈 목록으로 취급하지 않는다. 특정 작품이 첫 페이지에 있다는 가정을 제거한다.
3. run.mjs의 3곳 catalog 준비 조회를 readCatalogPages로 바꾸고 모든 페이지에서 template/무료·유료 회차를 찾는다. 기존 환경·coordinator·인증·cleanup 흐름을 유지한다.
4. suites.mjs에 content 다음으로 { id:'drama-pagination', collection:'drama-pagination.postman_collection.json', contentMode:'exclusive' }를 추가한다. 기존 content shared를 보존하고 선택/순서/중복/총 11개 검사를 적응한다.
5. 신규 suite는 Root와 기존 이름의 두 fixture login 요청을 포함한다. run.mjs에 실행별 fixture 준비/환경 생성/실행/finally cleanup을 연결하고 외부 환경 모드는 DB를 자동 변경하지 않는다.
6. 신규 dramaPaginationFixtures.mjs는 사용자의 기존 콘텐츠를 변경하지 않는다. 소유 공개 작품 31개(같은 publishedAt), 숨김·미래·undated, 전용 장르 두 개·다중 장르·프리뷰를 만든다. 무료/유료/회차 공개 수의 기존 검증은 기존 content suite에 유지한다.
7. UUID/genre id는 INSERT 전에 기록하고 사용자 상태를 정리한 후 owned 관계/영상/이미지/작품/장르를 제거한다. 일부 INSERT 실패와 cleanup 실패에도 나머지 정리를 시도하고 원래 실패를 보존한다. cleanup 잔여/재시도/다른 데이터 보존을 단위 검사한다.
8. 신규 fixture 전 수명은 exclusive lock 안에서 실행하고 기존 shared reader의 lock semantics는 바꾸지 않는다. 신규 key는 아래 환경 표와 일치시켜 task-2 문서 갱신에 전달한다.

| 환경 키 | 값 |
| --- | --- |
| catalogAllQuery / catalogThirtyQuery / catalogEmptyQuery | 실행별 제목 조건으로 각각 31/30/0개 |
| catalogTailQuery | allQuery의 page2 작품 1개 고유 제목 조건 |
| catalogLiteralQuery | %, _, escape 문자 literal 조건 |
| catalogGenreCodeA / catalogGenreCodeB / catalogGenreName | 전용 장르 두 코드, 제목에 없는 장르 A 이름 |
| catalogExpectedUuids / catalogThirtyExpectedUuids | 실제 정렬된 31/30개 UUID JSON 배열 |
| catalogGenreExpectedUuids / catalogLiteralExpectedUuids | allQuery+genre B 교집합/literal 조건 UUID JSON 배열 |
| catalogExcludedUuids | 숨김/미래/undated UUID JSON 배열 |
| catalogPreviewVideoUuid / catalogPreviewDramaUuid | 사용자별 저장 상태 검사용 프리뷰/부모 작품 |

추가 값의 정렬은 published_at DESC,id DESC이며 내부 id는 환경의 기대값 산출에만 사용한다. 신규 fixture를 독립적인 q prefix로 격리해 기존 DB 건수와 무관하게 경계를 검사한다. 기존 entitled/unentitled 로그인·UUID 환경 키는 재사용한다.

### 검증할 시나리오

- 0/30/31개와 page2/범위 밖, equal timestamp 전체 UUID 순서, 다중 장르 중복 방지.
- 첫 페이지에 없는 제목 검색, 장르명만 검색, q+genre, 없는 장르, q trim·대소문자·literal 특수문자, 공개 조건.
- 잘못된 page의 공통 경계, 중복/객체 q·genre, 잘못된 sort와 JWT, optional JWT와 userUuid 위조 방지.
- 프리뷰 저장 전/후 익명·사용자 A·B의 isSaved, 저장 DELETE와 최종 cleanup.
- helper HTTP 오류, response metadata 누락/다른 page/너무 많은 항목/잘못된 hasNext/중복 UUID, 부분 fixture 실패와 cleanup 실패.

### 주요 로직 코드 또는 변경 예시

helper 흐름의 기준 예시다. JSON 항목 전체 계약은 Postman에서 별도로 검사한다.

```js
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

핵심 HTTP 검사 형태(기존 item checker를 재사용한다):

```js
const body = pm.response.json();
pm.test('Catalog page exposes the common response', () => {
  pm.response.to.have.status(200);
  pm.expect(Object.keys(body).sort()).to.eql(['hasNext', 'items', 'page']);
  pm.expect(body.items).to.be.an('array');
  pm.expect(body.items.length).to.be.at.most(30);
  pm.expect(body.page).to.equal(1);
  pm.expect(body.hasNext).to.be.a('boolean');
});
```

이 검사만으로 기존 전체 항목 assertions를 대체하지 않는다. 새 fixture의 경계 테스트는 catalogExpectedUuids와 page1+page2 UUID를 완전히 비교하고 publishedAt 동률의 기대 순서를 검증한다.

### 반복 작업 위임

불가. 컬렉션별 후속 fixture 선택·소유권과 실행기 변화가 연결되어 별도 판단 없는 반복 패턴이 아니다. child 슬롯 0개다. task-3과 파일 충돌 없이 병렬 작성 가능하며 task-2는 이 task 완료 후 실행한다. 테스트 결함 수정 재배정 시 다른 worker가 종료했는지 부모가 먼저 확인한다.

