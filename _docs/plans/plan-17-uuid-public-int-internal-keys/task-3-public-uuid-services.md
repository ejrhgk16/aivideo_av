# task-3-public-uuid-services

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-17-uuid-public-int-internal-keys/task-1-data-preserving-migration.md`
- `_docs/plans/plan-17-uuid-public-int-internal-keys/task-2-entities-and-seed.md`
- `back/src/content/publicCatalogService.ts`
- `back/src/programming/publicCollectionService.ts`
- `back/test/unit/content/publicCatalogService.spec.ts`
- `back/test/unit/programming/publicCollectionService.spec.ts`

## 작업

정확한 수정 파일:

```text
back/src/content/publicCatalogService.ts
back/src/programming/publicCollectionService.ts
back/test/unit/content/publicCatalogService.spec.ts
back/test/unit/programming/publicCollectionService.spec.ts
```

1. `GET /dramas/:dramaId`, `GET /episodes/:episodeId/playback`, `GET /dramas/:dramaId/previews/:videoId/playback`가 기존 UUID를 받도록 유지한다. 먼저 `uuid` 고유 열로 외부 입력을 찾고, 이후 드라마·회차·영상·이미지·컬렉션·제작사 관계는 숫자 `id`와 정수 참조 열로 조회·조인한다. 다형성 `content_id` 조인은 `content_type` 조건을 함께 사용한다.
2. 목록·상세·컬렉션 응답에서 UUID 식별자의 기존 `id` 필드를 `uuid`로 바꾸고 `drama.uuid`, `episode.uuid`, `productionCompany.uuid`, `contentVideo.uuid`를 각각 넣는다. 숫자 장르의 `id`는 유지한다. API URL 경로 형태·공개 조건·정렬·S3 저장 키 및 URL도 유지한다. 쿼리 수가 불필요하게 늘지 않도록 기존 배치 조회와 재생용 단일 조인 방식의 목적을 유지한다.
3. 테스트 fixture에 서로 다른 UUID와 정수 `id`를 부여해 공개 JSON에 `uuid`가 있고 새 정수 기본키 `id`가 노출되지 않는지, 그 UUID를 상세·회차·프리뷰 요청에 다시 넣어 정상 조회되는지, 내부 관계는 정수로 조회되는지 검증한다. 특히 회차 FULL 재생과 드라마 PREVIEW 재생에서 잘못된 부모·영상 조합이 노출되지 않게 확인한다.

검증 명령: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.

완료 조건: 세 명령이 통과하고 기존 공개 UUID로 같은 콘텐츠와 저장 키를 얻는다. 공개 UUID 식별자의 응답 필드는 `uuid`이며 내부 조회·조인 조건에 UUID 부모 키가 남지 않는다.
