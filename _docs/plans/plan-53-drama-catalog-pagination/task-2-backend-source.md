# task-2-backend-source

## 기본 입력

- 이 task 문서와 index.json task-2 항목, 전달된 적용 지침, task-1 완료 요약.
- depends_on: [task-1]. task-1의 테스트·fixture·환경 계약을 변경하지 않고 제품 소스와 문서를 구현한다.
- 다른 작업자와 저장소를 공유한다. 타인의 변경을 되돌리지 않으며 자신의 files 안에서 apply_patch로만 수정한다.

## 읽어야 할 파일

- 아래 수정 파일 중 백엔드 3개: controller 목록 진입점, service listDramas/기존 공개 매핑, 응답 타입. listGenres와 이미지 코드는 수정하지 않는다.
- back/src/common/pagination/pagination.ts와 paginationResponses.ts 전체 export.
- back/src/content/entities/drama.entity.ts, dramaGenre.entity.ts, genre.entity.ts의 조회 키·공개 조건·관계.
- back/src/identity/optionalJwtAuthGuard.ts와 기존 controller의 인증 사용 구간.
- 아래 API 문서 2개에서 목록·공통 페이징 부분, back/README.md의 검증·suite·기본/외부 fixture 부분.
- 필요 스킬: .agents/skills/nestjs-best-practices/SKILL.md의 조회/검증 관련 지침, api-and-interface-design/SKILL.md의 기존 계약 보존·경계 검증. 적용 지침이 이미 전달되면 재독하지 않는다.
- 테스트는 task-1 완료 요약의 환경·실행 결과를 먼저 사용한다. 실행만을 위해 테스트 전체를 읽지 않는다.

## 필요 시 참고할 문서

- 루트 AGENTS.md가 전달되지 않았거나 변경된 경우에만 해당 원문을 확인한다.
- 파일 책임·계층 경계를 바꿔야 한다고 판단한 경우에만 _docs/ARCHITECTURE.md의 Backend/Frontend 및 Boundaries를 확인한다. 승인 범위 밖 변경이면 부모에게 보고한다.
- 아래 계약에 누락·충돌이 있을 때만 같은 폴더 plan.md의 명시한 계약 섹션을 확인한다. 전체 plan 재독은 필수가 아니다.
- 역할/상태/검증 규칙이 누락된 경우에만 _docs/plans/README.md의 해당 절을 확인한다.

## 실패 시 참고할 파일

- HTTP 실패: back/test/api/drama-pagination.postman_collection.json, 해당 실패 suite 컬렉션의 요청/assertion과 task-1 소유 run.mjs/catalogPages.mjs/dramaPaginationFixtures.mjs의 관련 구간.
- 내부 회귀 실패: back/test/unit/content/publicCatalogService.spec.ts 및 back/test/unit/api/{catalogPages,dramaPaginationFixtures,suiteSelection}.spec.ts 중 실패한 검사.
- 격리/lock 실패: back/test/api/verifyParallel.mjs, fixtureContext.mjs, contentLock.mjs의 실패 경로.
- 테스트 결함이면 부모에게 계약·입력·실패 근거를 보고한다. 이 task는 테스트 수정 권한이 없다.

## 작업

### 역할과 완료 조건

소스 구현·실행 역할이다. 승인된 C1을 구현하고 문서와 검증을 완료한다. C2의 기존 GET /genres 응답·이미지 코드는 유지한다. task-1 작성 완료는 기능 통과가 아니므로 아래 checks를 모두 실제 실행하고 통과해야 완료한다. 새 dependency/schema/공통 pagination 변경을 추가하지 않는다.

### 수정 허용 파일

```text
back/src/content/publicCatalogController.ts
back/src/content/publicCatalogService.ts
back/src/content/contentResponses.ts
_docs/api/02-content/dramas.md
_docs/api/00-overview/conventions.md
back/README.md
```

### Checks

```powershell
npm --prefix back run lint
npm --prefix back run test:api -- --suite content --suite drama-pagination
npm --prefix back run test
npm --prefix back run test:api:parallel
npm --prefix back run build
```

### 적용 계약

C1 정의 책임:
```ts
// contentResponses.ts
import type { PageResponse } from '../common/pagination/paginationResponses.js';
export type DramaPageResponse = PageResponse<DramaSummaryResponse>;
// publicCatalogService.ts
export type DramaListOptions = { page: number; q?: string; genre?: string };
export const DRAMA_PAGE_SIZE = 30;
// service 메서드
listDramas(options: DramaListOptions, now?: Date, userUuid?: string): Promise<DramaPageResponse>;
// controller 메서드(@Query(), @Req())
listDramas(query: Record<string, unknown>, request: AuthenticatedRequest): Promise<DramaPageResponse>;
```

- sort 생략/단일 latest, page 기본1/공통 parsePage, q/genre trim한 단일 문자열(빈 값 제외). 배열·객체는 400, 없는 genre는 빈 결과.
- q: 제목 OR 연결 장르명 대소문자 미구분 부분 검색, %, _, escape는 literal. genre 코드 조건과 AND. 다중 장르로 중복되지 않음.
- PUBLISHED/publishedAt<=now -> published_at DESC/id DESC -> offset/31개 -> 공통 response로 최대30개 -> 그 30개 관계만 보강.
- 최상위 items/page/hasNext만. 빈/범위 밖은 200/[]/false. 기존 item·optional JWT·isSaved와 오류를 유지한다.

C2는 기존 GET /genres 응답 { id, code, name, tileImage } 배열을 그대로 사용하는 계약이다. 장르 endpoint·응답 타입·이미지 함수·장르 API 문서를 바꾸지 않는다. 프론트 연결은 task-4 담당이다.

C5 fixture/suite 계약은 task-1 완료 요약과 아래 문서 갱신 항목으로 소비한다. C6 도구는 설치 Vitest 4.1.11/Postman CLI다.

### 구현 지시

1. controller에서 경계 입력을 검증하고 parsePage(query.page, DRAMA_PAGE_SIZE)로 정규화한다. query.userUuid를 사용자 결정에 쓰지 않는다. 잘못된 sort의 기존 400 동작을 유지한다.
2. service에서 QueryBuilder를 사용한다. q와 genre는 correlated EXISTS 등 작품 행 수를 늘리지 않는 조건으로 표현한다. SQL parameter와 명시적 LIKE escape를 사용하고 필터 후 페이지를 적용한다.
3. 최대31개를 조회한 직후 createPageResponse를 적용한다. 기존 항목 보강 로직의 대상 배열만 page.items로 제한한다. 빈 페이지는 연관 조회 없이 공통 응답을 반환한다.
4. dramas.md의 query/request/response/인증/노출·정렬을 C1로 수정한다. conventions.md에는 이 목록도 공통 페이지 형식과 offset 동작을 따른다고 기록한다.
5. back/README.md의 suite 순서는 content 다음 drama-pagination(총11개)로 갱신한다. 신규 suite의 31개·장르·공개 제외 fixture, exclusive lock, 외부 환경 키·정리 책임과 페이지 탐색을 기록한다. 다른 하위 README/AGENTS는 만들지 않는다.
6. 선택 suite 실행 후 전체 unit/HTTP와 기존 parallel 격리를 검사한다. run.mjs와 다수 suite 소비가 변경되어 전체 회귀가 필요하다. 서버/DB가 없거나 현재 코드를 반영하지 않으면 성공으로 보고하지 않는다.

문서화할 C5 추가 외부 환경 키:
catalogAllQuery, catalogThirtyQuery, catalogEmptyQuery, catalogTailQuery, catalogLiteralQuery,
catalogGenreCodeA, catalogGenreCodeB, catalogGenreName,
catalogExpectedUuids, catalogThirtyExpectedUuids, catalogGenreExpectedUuids,
catalogLiteralExpectedUuids, catalogExcludedUuids,
catalogPreviewVideoUuid, catalogPreviewDramaUuid.
기존 entitled/unentitled 로그인/UUID 변수는 재사용한다. 각 expected 값은 정렬된 UUID JSON 배열이며 task-1의 환경 표와 정확히 대조한다. 외부 환경 모드는 자동 fixture 생성/정리를 하지 않는다.

### 주요 로직 코드 또는 변경 예시

controller 정규화의 기준 흐름이다. AuthenticatedRequest와 기존 guard는 현재 선언을 유지한다.

```ts
listDramas(
  @Query() query: Record<string, unknown>,
  @Req() request: AuthenticatedRequest,
): Promise<DramaPageResponse> {
  if (query.sort !== undefined && query.sort !== 'latest') {
    throw new BadRequestException('sort must be latest');
  }
  const readText = (value: unknown): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new BadRequestException('Invalid filter');
    return value.trim() || undefined;
  };
  const page = parsePage(query.page, DRAMA_PAGE_SIZE);
  const q = readText(query.q);
  const genre = readText(query.genre);
  const options: DramaListOptions = {
    page,
    ...(q ? { q } : {}),
    ...(genre ? { genre } : {}),
  };
  return this.publicCatalogService.listDramas(options, undefined, request.user?.uuid);
}
```

미지정 필드를 실제 options 객체에서 생략하는 구현도 허용하되 controller 테스트는 undefined 필드와 생략을 같은 의미로 다뤄야 한다. 외부 shape 계약은 HTTP query이며 private 객체 키 수를 고정하지 않는다.

service의 페이지 적용 위치 예시다. q/genre는 getMany 이전의 같은 query에 parameterized EXISTS로 적용한다.

```ts
const { offset, limit } = getPageWindow(options.page, DRAMA_PAGE_SIZE);
const query = this.dramaRepository.createQueryBuilder('drama')
  .where('drama.status = :status', { status: PUBLIC_STATUS })
  .andWhere('drama.publishedAt <= :now', { now });
const escapeLike = (text: string) => text.replace(/[!%_]/g, (value) => '!' + value);
if (options.q) {
  const search = '%' + escapeLike(options.q.toLocaleLowerCase()) + '%';
  query.andWhere(
    "(LOWER(drama.title) LIKE :search ESCAPE '!' OR EXISTS (" +
    "SELECT 1 FROM drama_genres search_link INNER JOIN genres search_genre " +
    "ON search_genre.id = search_link.genre_id WHERE search_link.drama_id = drama.id " +
    "AND LOWER(search_genre.name) LIKE :search ESCAPE '!'))",
    { search },
  );
}
if (options.genre) {
  query.andWhere(
    "EXISTS (SELECT 1 FROM drama_genres genre_link INNER JOIN genres selected_genre " +
    "ON selected_genre.id = genre_link.genre_id WHERE genre_link.drama_id = drama.id " +
    "AND selected_genre.code = :genre)",
    { genre: options.genre },
  );
}
const rows = await query.orderBy('drama.publishedAt', 'DESC')
  .addOrderBy('drama.id', 'DESC').offset(offset).limit(limit).getMany();
const result = createPageResponse(rows, options.page, DRAMA_PAGE_SIZE);
const dramas = result.items;
if (dramas.length === 0) return result;
const dramaIds = dramas.map((drama) => drama.id);
```

이후 기존 관계 조회는 이 dramaIds로 수행하고 기존 dramas.map의 항목을 result의 items로 반환한다. 새 mapper export나 private abstraction을 선행 설계하지 않는다. QueryBuilder 안의 EXISTS 조건은 raw 실행 SQL이 아니며 기존 쿼리 패턴을 따른다.

### 반복 작업 위임

불가. 쿼리·공개 계약·문서·검증이 연결되어 단순 파일 반복이 아니다. child 슬롯0. task-3과 병렬 가능하고 task-4는 이 task 완료 후 실행한다.

