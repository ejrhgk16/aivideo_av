# task-3-backend-code-filename-camelcase

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-6-front-common-structure/task-1-common-layer-restructure.md
- back/README.md
- back/src/content/content.module.ts
- back/src/programming/programming.module.ts
- back/src/common/database/databaseConfig.ts

## 작업

task-2 완료 후 실행한다. 아래 14개 파일을 이전 경로에서 새 경로로 옮긴다. 이전·새 경로와 아래 추가 수정 파일이 정확한 변경 범위이며 계획의 index.json task-3.files와 일치한다.

| 이전 경로 | 새 경로 |
| --- | --- |
| back/src/content/public-catalog.service.ts | back/src/content/publicCatalogService.ts |
| back/src/content/public-catalog.controller.ts | back/src/content/publicCatalogController.ts |
| back/src/content/media-url.ts | back/src/content/mediaUrl.ts |
| back/src/content/media-storage.ts | back/src/content/mediaStorage.ts |
| back/test/unit/content/public-catalog.service.spec.ts | back/test/unit/content/publicCatalogService.spec.ts |
| back/test/unit/content/media-url.spec.ts | back/test/unit/content/mediaUrl.spec.ts |
| back/test/unit/content/media-storage.spec.ts | back/test/unit/content/mediaStorage.spec.ts |
| back/src/programming/public-collection.service.ts | back/src/programming/publicCollectionService.ts |
| back/src/programming/public-collection.controller.ts | back/src/programming/publicCollectionController.ts |
| back/test/unit/programming/public-collection.service.spec.ts | back/test/unit/programming/publicCollectionService.spec.ts |
| back/src/common/database/migrations/20261005000000-initAiDrama.ts | back/src/common/database/migrations/20261005000000InitAiDrama.ts |
| back/src/common/database/migrations/20261015000000-replaceContentMedia.ts | back/src/common/database/migrations/20261015000000ReplaceContentMedia.ts |
| back/src/common/database/migrations/20261016000000-updateMediaStorageKeys.ts | back/src/common/database/migrations/20261016000000UpdateMediaStorageKeys.ts |
| back/src/common/database/migrations/20261019000000-addLandscapePoster.ts | back/src/common/database/migrations/20261019000000AddLandscapePoster.ts |

추가 수정 가능 파일:

- back/src/content/content.module.ts
- back/src/programming/programming.module.ts
- back/src/common/database/seed/initialData.ts
- back/test/unit/database/initialData.spec.ts
- back/README.md
- _docs/ARCHITECTURE.md

파일 내용은 import 경로와 현재 문서의 경로 갱신 외에 임의로 리팩터링하지 않는다. 마이그레이션 클래스명, timestamp, SQL과 이미 적용된 DB 이력은 변경하지 않는다. 과거 완료된 plan 문서는 당시 실행 기록으로 유지한다.

검증 명령: npm --prefix back run lint, npm --prefix back run test, npm --prefix back run build.

완료 조건: back/src와 back/test의 코드 파일 basename에 하이픈이 남지 않고, import와 현재 문서 경로가 실제 파일명과 일치하며 검증 명령이 통과한다.
