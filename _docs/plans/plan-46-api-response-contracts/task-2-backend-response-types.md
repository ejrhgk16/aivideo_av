# task-2-backend-response-types

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/test/api/README.md`
- `_docs/api/00-overview/response-compatibility.md`
- `_docs/plans/plan-46-api-response-contracts/task-5-content-response-types.md`
- `_docs/plans/plan-46-api-response-contracts/task-6-programming-response-types.md`
- `_docs/plans/plan-46-api-response-contracts/task-7-identity-response-types.md`
- `_docs/plans/plan-46-api-response-contracts/task-8-economy-response-types.md`
- `_docs/plans/plan-46-api-response-contracts/task-9-saved-video-response-types.md`
- `back/src/content/contentResponses.ts`
- `back/src/content/publicCatalogService.ts`
- `back/src/content/publicCatalogController.ts`
- `back/src/programming/programmingResponses.ts`
- `back/src/programming/publicCollectionService.ts`
- `back/src/programming/publicCollectionController.ts`
- `back/src/identity/identityResponses.ts`
- `back/src/identity/loginService.ts`
- `back/src/identity/tokenService.ts`
- `back/src/identity/loginController.ts`
- `back/src/identity/refreshCookie.ts`
- `back/src/economy/pointResponses.ts`
- `back/src/economy/pointService.ts`
- `back/src/economy/pointController.ts`
- `back/src/playback/savedVideoResponses.ts`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/savedVideoController.ts`

## 작업

task-5/6/7/8/9가 병렬로 정리한 응답 type을 통합 검증하고 공통 Architecture 문서를 갱신한다. 기존 task-2의 제품 구현은 다섯 도메인 task로 옮겼으며 기존 task-3/4 ID와 의존성은 유지한다. 여기서는 도메인별 작업을 다시 수행하지 않는다.

### 정확한 변경과 역할

1. `_docs/ARCHITECTURE.md`에 `src/{domain}/*Responses.ts`의 공개 응답 type 책임, 서비스 내부 DB 행 타입과의 분리, named type + Promise 반환 규칙을 명시한다. 프론트의 기능별 응답 type 파일과 기존 feature type export 유지, front/back 계약 독립 정의 원칙도 함께 적는다. global error 책임 설명은 뒤따르는 task-3에서 갱신한다.
2. 다섯 도메인의 선언 위치·이름·type import·반환 annotation이 연결되는지 검토한다. 이 task에는 통합 컴파일 실패를 해결하기 위한 기존 제품 파일 범위를 유지한다. 수정은 도메인 경계의 type import/export·alias·반환 annotation 불일치를 고치는 경우로 한정하고, 성공 객체·쿼리·runtime 흐름·오류 정책을 바꾸지 않는다.
3. 모든 병렬 제품 편집이 끝난 후 back build를 한 번 실행한다. 공통 dist/ 및 tsbuildinfo에 쓰는 빌드는 이 단계에서만 수행한다. task-3/4는 이 task가 완료되기 전 시작하지 않는다.
4. 기존 3000 서버가 모든 도메인 변경을 반영한 것을 HTTP로 확인하고 6개 영향 suite를 실행한다. task-1의 strict 성공·기존 업무 오류 assertion은 읽기 전용이며 이 task의 files에 컬렉션을 넣지 않는다. 강화한 assertion을 완화하거나 새 반환값에 맞춰 기대값을 바꾸지 않는다.
5. baseline과 동일한 기존 성공 본문·값·정렬·키·nullable·HTTP 상태·204 빈 본문·native/web 차이를 보존해야 한다. 일반 오류도 아직 task-3 전이므로 기존 형식이어야 한다. baseline 단계와 통합 후 결과를 구분해 완료 요약에 기록한다.

### 주요 로직 코드 또는 변경 예시

새 런타임 로직은 없다. Architecture의 정확한 추가 내용은 다음 규칙이다.

- Backend `src/{domain}/*Responses.ts`: named TypeScript type으로 공개 API 응답을 정의하며 DB Entity/조회 행 타입과 구분한다. API 비동기 반환은 `Promise<ResponseType>`, 배열은 `Promise<ResponseType[]>`, 빈 응답은 `Promise<void>`로 선언한다.
- Frontend 기능별 `*Responses.ts`: 해당 API 응답 type을 정의하고 기존 feature 파일의 type export를 유지한다. front와 back은 서로의 소스를 import하지 않는다.
- 성공 응답은 현재 JSON 원본·텍스트·204를 유지하며 envelope/serializer는 추가하지 않는다.

컴파일 오류를 해결할 때는 실제 기존 HTTP 응답을 기준으로 선언만 맞춘다. 예를 들어 native 응답은 refreshToken 필수이고 web 응답에는 없으며 cookie 없는 refresh는 void다. catalog/detail productionCompany는 string|null, collection은 객체|null이다. 이 차이를 없애거나 필드를 optional로 변경해 컴파일만 통과시키지 않는다.

### 수정 허용 파일

- `back/src/content/contentResponses.ts`
- `back/src/content/publicCatalogService.ts`
- `back/src/content/publicCatalogController.ts`
- `back/src/programming/programmingResponses.ts`
- `back/src/programming/publicCollectionService.ts`
- `back/src/programming/publicCollectionController.ts`
- `back/src/identity/identityResponses.ts`
- `back/src/identity/loginService.ts`
- `back/src/identity/tokenService.ts`
- `back/src/identity/loginController.ts`
- `back/src/identity/refreshCookie.ts`
- `back/src/economy/pointResponses.ts`
- `back/src/economy/pointService.ts`
- `back/src/economy/pointController.ts`
- `back/src/playback/savedVideoResponses.ts`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/savedVideoController.ts`
- `_docs/ARCHITECTURE.md`

### 의존성과 검증 명령

depends_on: `["task-5", "task-6", "task-7", "task-8", "task-9"]`. 기존 task-1 baseline은 위 task를 통해 선행한다.

~~~text
npm --prefix back run build
npm --prefix back run test:api -- --suite identity --suite content --suite programming --suite playback --suite economy --suite saved-videos
~~~

6개 suite는 identity/content/programming/playback/economy/saved-videos의 실제 소비 기능을 검사한다. 루트·시청기록은 이 단계에서 제품 변경이 없으며 task-1/3의 8개 suite에 포함된다. 도메인별 내부 테스트는 task-5/6/7/8/9에서 수행하므로 같은 선택 테스트를 무의미하게 다시 실행하지 않는다. 통합 중 새로운 수정·실패가 있으면 해당 도메인의 선택 테스트를 추가 실행하고 결과를 기록한다.

### 완료 조건

- 다섯 도메인 task가 완료되었고 back build 및 6개 API suite가 통과한다.
- 정확한 Architecture 책임과 타입·레이어 경계가 기록되어 있다.
- task-1의 성공·업무 오류 strict assertion은 수정하지 않았다. 기존 응답과 달라진 성공 필드·값·타입·상태가 없다.
- 서버 연결 실패·필수 데이터 부족·반영 여부 미확인·cleanup 실패는 검증 실패다. 자동 서버 시작/다른 포트/seed/reset으로 우회하지 않는다.
- 이후 task-3(전역 오류)과 task-4(프론트)가 병렬 실행될 수 있다.
