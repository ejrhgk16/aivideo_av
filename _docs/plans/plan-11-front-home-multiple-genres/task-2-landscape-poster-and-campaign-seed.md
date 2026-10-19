# task-2: 가로 포스터 종류와 캠페인 시드 추가

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/src/content/entities/contentImage.entity.ts`
- `back/src/content/media-storage.ts`
- `back/src/common/database/seed/initialData.ts`
- 기존 `content_images` 마이그레이션과 백엔드 단위 테스트

## 작업
변경 파일은 plan index의 `task-2.files`에 선언된 파일만 허용한다.

- 기존 `POSTER`를 세로 이미지로 유지하고 `POSTER_LANDSCAPE`를 `content_images.kind` 허용값에 추가한다. Entity 체크와 기존 DB를 위한 새 마이그레이션을 맞춘다. 기존 레코드는 변경하지 않는다.
- `createDramaImageStorageKey`가 새 종류에 대해 `dramas/:dramaId/images/poster-landscape/:imageId.webp`를 만들 수 있게 한다.
- 기존 드라마 다섯 편에 각각 가로 포스터 시드 레코드를 하나씩 추가한다. 종류는 `POSTER_LANDSCAPE`이고, 초기 `storageKey`는 해당 작품의 기존 `HOME_HERO` 시드 레코드와 동일한 파일 경로를 참조한다. ID는 기존 시드와 중복되지 않게 한다. 바이너리 파일은 복사하지 않는다.
- 로맨스 장르의 기존 시드 작품 한 편을 담는 활성 `HOME_CAMPAIGN` 컬렉션을 추가한다. 캠페인 이미지는 해당 작품의 기존 `CAMPAIGN` 레코드를 사용한다. 기존 컬렉션 편성과 API endpoint는 변경하지 않는다.
- 데이터 모델 문서와 해당 단위 테스트를 갱신한다.
- 완료 조건: 세로·가로 포스터가 별도 `kind` 레코드로 존재하고, 초기 가로 레코드는 기존 `HOME_HERO` 파일을 참조하며, `HOME_CAMPAIGN`에 로맨스 작품 한 편이 편성된다.
- 검증 명령: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.
