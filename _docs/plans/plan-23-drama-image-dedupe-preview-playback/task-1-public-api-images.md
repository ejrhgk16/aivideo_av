# task-1-public-api-images

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- back/src/content/publicCatalogService.ts
- back/src/programming/publicCollectionService.ts
- back/test/unit/content/publicCatalogService.spec.ts
- back/test/unit/programming/publicCollectionService.spec.ts
- _docs/api/02-content/dramas.md
- _docs/api/03-programming/collections.md

## 작업

목표: GET /dramas, GET /dramas/:dramaId, GET /collections/:code의 공개 응답에서 images 객체를 제거한다. 저장소 키를 조회하거나 imageUrls를 생성하는 내부 로직은 유지한다.

정확한 변경 파일:

- back/src/content/publicCatalogService.ts
- back/src/programming/publicCollectionService.ts
- back/test/unit/content/publicCatalogService.spec.ts
- back/test/unit/programming/publicCollectionService.spec.ts
- _docs/api/02-content/dramas.md
- _docs/api/03-programming/collections.md

PublicCatalogService의 DramaSummary와 DramaDetail, PublicCollectionService의 PublicDramaSummary에서 공개 images 필드를 제거한다. 목록·상세·컬렉션 반환 객체에서 images 속성을 빼고 imageUrls는 동일한 저장소 키로 생성한다. 테스트는 세 응답에 images 속성이 없고 imageUrls 값이 유지됨을 확인한다. 두 API 문서의 JSON 예시, 필드 표, 노출 규칙에서 images 설명을 제거하고 구현과 일치시킨다.

검증 명령: npm --prefix back run lint, npm --prefix back run test, npm --prefix back run build

완료 조건: 세 공개 응답에 images가 없고 imageUrls가 기존과 같으며, 단위 테스트와 API 문서가 새 계약을 반영한다.

### 주요 로직 코드 또는 변경 예시

목록 응답의 핵심 매핑은 다음 형태로 유지한다. 상세와 컬렉션도 저장소 키를 내부 값으로 사용한 뒤 imageUrls만 반환한다.

~~~ts
const dramaImagesForResponse = mapImages(dramaImages);
return {
  uuid: drama.uuid,
  slug: drama.publicSlug,
  title: drama.title,
  shortDescription: drama.shortDescription,
  productionCompany: companiesById.get(drama.productionCompanyId) ?? null,
  genres: dramaGenresForDrama
    .map((link) => genresById.get(link.genreId))
    .filter((genre): genre is Genre => genre !== undefined)
    .map(({ id, code, name }) => ({ id, code, name })),
  imageUrls: createDramaImageUrls(dramaImagesForResponse),
  previewVideos: mapPreviewVideos(dramaVideos),
  episodeCount: dramaEpisodes.length,
  freeEpisodeCount: dramaEpisodes.filter((episode) => episode.pricePoints === 0).length,
};
~~~
