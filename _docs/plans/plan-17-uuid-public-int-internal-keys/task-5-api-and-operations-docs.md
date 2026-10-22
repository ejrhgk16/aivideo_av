# task-5-api-and-operations-docs

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`
- `_docs/api/04-playback/episodes.md`
- `back/README.md`
- `back/src/content/publicCatalogService.ts`
- `back/src/programming/publicCollectionService.ts`
- `back/src/common/database/migrations/20261022000000UseNumericPrimaryKeys.ts`

## 작업

정확한 수정 파일:

```text
_docs/api/00-overview/conventions.md
_docs/api/02-content/dramas.md
_docs/api/03-programming/collections.md
_docs/api/04-playback/episodes.md
back/README.md
```

1. 공통 API 규칙과 각 관련 API 정의의 예시·필드 표에서 작품·회차·제작사·프리뷰 영상의 공개 `id`를 `uuid`로 바꾼다. DB의 자동 증가 `id`는 응답에 노출하지 않고 내부 조인·관계에만 사용한다. 숫자 장르 `id`는 유지한다. `uuid` 값이 작품·회차·프리뷰 요청 경로에 전달된다는 점을 명시한다. 특히 회차 재생 문서의 `episodes.drama_id = dramas.id`, `content_videos.content_id = episodes.id`가 정수 키 비교임을 명확히 한다. URL 경로 형태·오류·인증·노출 규칙은 기존 동작과 일치시킨다.
2. `back/README.md`에 `DB_SYNCHRONIZE=false`, 복원 가능한 백업, 별도 MySQL 테스트 DB에서 기존 데이터의 행 수·UUID·관계·저장 키 비교, 마이그레이션 적용 순서를 적는다. MySQL DDL이 전체 트랜잭션으로 롤백되지 않는 점과 실패 시 백업 복원 경로를 알린다. 운영 DB에 직접 적용하는 명령은 실행하지 않는다.

검증 명령: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.

완료 조건: API 문서가 공개 `uuid` 필드와 정수 내부 조인을 정확히 반영하고, 백엔드 운영 문서에 데이터 보존 확인 절차가 있다. 세 검증 명령이 통과한다.
