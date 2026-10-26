# task-2-front-image-contract

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- front/src/features/drama/dramaContent.ts
- front/src/features/home/homeContent.ts
- front/tests/unit/dramaContent.test.ts
- front/tests/unit/homeContent.test.ts

## 작업

목표: 프론트의 세 공개 응답 타입과 테스트 fixture에서 images 객체를 제거한다.

정확한 변경 파일:

- front/src/features/drama/dramaContent.ts
- front/src/features/home/homeContent.ts
- front/tests/unit/dramaContent.test.ts
- front/tests/unit/homeContent.test.ts

DramaContent, DramaSummary, HomeCollectionDrama의 images 속성 선언을 삭제한다. imageUrls 선언과 사용은 유지한다. 드라마 목록·상세·컬렉션 요청 테스트의 응답 fixture에서 images 객체를 삭제하고 결과가 새 응답 형태와 일치하는지 확인한다. 새 로직은 없고 타입과 fixture의 정확한 필드 삭제만 필요하므로 별도 로직 코드 블록은 두지 않는다.

검증 명령: npm --prefix front run typecheck, npm --prefix front run test, npm --prefix front run export

완료 조건: 세 타입과 테스트 fixture에 images가 없고, 프론트가 imageUrls로 계속 타입 검사 및 빌드된다.
