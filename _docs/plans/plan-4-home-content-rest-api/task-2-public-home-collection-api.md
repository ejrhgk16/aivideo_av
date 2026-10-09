# task-2-public-home-collection-api

## 읽어야 할 파일

- `AGENTS.md`
- `back/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/scope.md`
- `_docs/AI_DRAMA_data_model/03-programming/README.md`
- `_docs/AI_DRAMA_data_model/03-programming/content_collections.md`
- `_docs/AI_DRAMA_data_model/03-programming/collection_dramas.md`
- `back/src/programming/entities/contentCollection.entity.ts`
- `back/src/programming/entities/collectionDrama.entity.ts`
- `back/src/content/entities/drama.entity.ts`
- `back/src/content/entities/dramaGenre.entity.ts`
- `back/src/content/entities/dramaImage.entity.ts`
- `back/src/content/entities/episode.entity.ts`
- `back/src/content/entities/genre.entity.ts`
- `back/src/content/entities/productionCompany.entity.ts`

## 작업

`back/src/programming/`에 편성 전용 Nest 모듈, 컨트롤러, 서비스를 만든다. `content` 도메인의 서비스나 DTO를 import하지 않으며, 이 API의 조회와 응답 조립은 이 서비스 안에서 완결한다.

- `GET /content-collections/:code`를 구현한다. 비활성 컬렉션이나 존재하지 않는 컬렉션은 404로 처리한다.
- 컬렉션 작품은 `displayOrder` 오름차순으로 반환한다. `startsAt`이 없거나 현재 시각 이하이고, `endsAt`이 없거나 현재 시각보다 이후인 편성만 포함한다.
- 연결된 작품과 회차는 모두 공개 조건(`PUBLISHED`, `published_at <= now`)을 만족할 때만 노출한다.
- 응답은 컬렉션 `code`, `title`, `description`과 작품 목록을 포함한다. 각 목록 항목은 `displayOrder`와 해당 API 안에서 조립한 작품 요약(식별자·slug·제목·짧은 소개·제작사·장르·이미지 storage key·공개/무료 회차 수)을 담는다.
- 활성 여부, 편성 기간, 작품 공개 여부, `displayOrder` 보존, 404를 `back/test/unit/programming/public-collection.service.spec.ts`에서 데이터베이스 없이 TypeORM repository/query builder mock으로 검증한다.
- 카탈로그 서비스 공유, 프론트 연결, 추천 피드, 이미지 URL 변환은 추가하지 않는다.

완료 조건: GET route가 모듈에 선언되고, 서비스 단위 테스트가 편성·공개 조건·순서·404를 검증하며 아래 명령이 모두 통과한다.

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```
