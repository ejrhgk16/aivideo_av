# task-1-public-catalog-api

## 읽어야 할 파일

- `AGENTS.md`
- `back/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/scope.md`
- `_docs/AI_DRAMA_data_model/02-content/README.md`
- `back/src/content/entities/drama.entity.ts`
- `back/src/content/entities/dramaGenre.entity.ts`
- `back/src/content/entities/dramaImage.entity.ts`
- `back/src/content/entities/episode.entity.ts`
- `back/src/content/entities/genre.entity.ts`
- `back/src/content/entities/productionCompany.entity.ts`

## 작업

`back/src/content/`에 콘텐츠 전용 Nest 모듈, 컨트롤러, 서비스를 만든다. 다른 도메인의 서비스·DTO를 만들거나 사용하지 않는다.

- `GET /dramas?sort=latest`를 구현한다. `sort`는 홈에서 쓰는 `latest`만 지원한다. 현재 시각을 기준으로 `status = PUBLISHED` 및 `published_at <= now`인 작품만 최신 공개일 내림차순으로 반환한다.
- 각 작품에는 `id`, `slug`(`publicSlug`), `title`, `shortDescription`, 제작사명, 장르 목록, `POSTER`·`HERO`·`THUMBNAIL` 이미지의 `storageKey`, 공개 회차 수, `pricePoints = 0`인 공개 회차 수를 반환한다. 회차 집계도 같은 공개 조건을 적용한다.
- `GET /genres`를 구현한다. 장르 `id`, `code`, `name`을 `displayOrder` 오름차순으로 반환한다.
- 목록 조회와 장르 정렬, 비공개·예약 작품/회차 제외, 회차 집계 결과를 `back/test/unit/content/public-catalog.service.spec.ts`에서 검증한다. 데이터베이스 연결 없이 TypeORM repository/query builder를 mock한다.
- 프론트 연결, 페이지네이션, 검색, CORS 설정, 이미지 URL 변환은 추가하지 않는다.

완료 조건: 두 GET route가 모듈에 선언되고, 서비스 단위 테스트가 공개 조건·정렬·응답 데이터를 검증하며 아래 명령이 모두 통과한다.

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```
