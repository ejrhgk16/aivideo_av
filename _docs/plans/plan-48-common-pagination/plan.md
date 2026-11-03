# plan-48-common-pagination

## 목표

백엔드의 페이지 입력 검증, offset·조회 개수 계산, 페이지 응답 생성과 응답 타입을 공통화하고, 현재 유일한 소비 기능인 저장 영상 목록에 적용한다. 기존 HTTP 계약을 유지하는 리팩토링이다.

사용자가 범위와 task 구성을 각각 승인했다. 이 계획 생성 단계에서는 제품 코드 수정, worker 실행, Git 명령 실행을 하지 않는다.

## 범위와 비목표

- `back/src/common/pagination/pagination.ts`에 `parsePage`, `getPageWindow`, `createPageResponse`를 추가하고 `paginationResponses.ts`에 `PageResponse<T>`를 정의한다.
- 페이지 크기는 각 기능이 코드에서 지정한다. 저장 영상은 기존처럼 30개이며, 이를 query로 설정하는 기능은 추가하지 않는다.
- 저장 영상 Controller·Service·응답 타입을 공통 함수·타입으로 전환한다. DB 쿼리와 영상별 응답 변환은 저장 영상 서비스에 남긴다.
- 기존 `GET /me/saved-videos`의 기본 page 1, 엄격한 페이지 입력 검증, 안전 정수·offset 범위 검사, 고정 크기 30, `limit` 무시, `items`·`page`·`hasNext` 응답을 유지한다.
- JWT 사용자 격리, 현재 공개 조건을 적용한 후의 DB 페이징, `saved_at DESC, video_id DESC` 정렬, 저장·삭제 동작과 UTC 직렬화를 유지한다.
- `_docs/ARCHITECTURE.md`에 공통 디렉터리 책임을 추가하고, 저장 영상 API 문서에 기존 입력 허용 규칙을 구체적으로 명시한다. Postman의 거부 입력 사례를 보강한다.
- 다른 API의 페이징 추가, 커서 방식 전환, 총 개수 조회, 프론트·DB·시드·의존성·테스트 실행기 변경은 범위 밖이다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 공통 페이징 정의 | `back/src/common/pagination/pagination.ts`, `back/src/common/pagination/paginationResponses.ts`, `_docs/ARCHITECTURE.md` | 공통 함수·제네릭 응답 타입 생성과 책임 문서화 |
| 2 | 저장 영상 적용 | `back/src/playback/savedVideoController.ts`, `back/src/playback/savedVideoService.ts`, `back/src/playback/savedVideoResponses.ts`, `back/test/api/saved-videos.postman_collection.json`, `_docs/api/04-playback/saved-videos.md` | 기존 소비 기능 전환, 엄격한 입력 회귀 검증·문서 보강 |

정확한 수정 허용 목록, 의존성과 검증 명령은 이 폴더의 `index.json`과 각 `task-*.md`에 정의한다. 기존 단위 테스트는 읽고 실행하기만 하므로 수정 허용 목록에 넣지 않는다.

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성이 없지만 이 계획에서 병렬 실행할 task는 없다. 공통 인터페이스를 먼저 확정한다.
- `task-2`는 `task-1` 완료 후 실행한다. task-1에서 생성한 함수·타입을 실제 소비 기능에서 사용해야 하므로 파일 수정 범위가 겹치지 않아도 병렬 실행하지 않는다.
- task-1의 build가 생성하는 `back/dist/`와 빌드 캐시는 task-2의 HTTP 검증과 동시에 갱신하지 않는다. API 검증은 기존 개발 서버에 현재 소스가 반영된 것을 확인한 후 수행한다.
- `saved-videos` suite는 독점 content lock을 사용한다. 기존 runner가 실행별 사용자·영상 fixture를 생성하고 소유한 데이터만 정리하도록 유지한다. 같은 개발 콘텐츠를 사용하는 다른 API 검증과 수동 fixture 변경을 겹치지 않는다.

## 검증과 영향 범위

| 대상 | 검증 명령 | 확인할 내용 |
| --- | --- | --- |
| 공통 함수·타입·문서 | `npm --prefix back run build` | 신규 공통 코드와 제네릭 타입의 컴파일, 기존 모듈과의 호환성. 문서는 실제 export와 디렉터리 책임을 대조해 확인 |
| 저장 영상 내부 경계 | `npm --prefix back run test:unit -- test/unit/playback/savedVideoService.spec.ts` | 기존 UTC 직렬화, 응답 항목 변환, DB 오류 전파와 조회 크기 보존 |
| 공통 함수의 실제 소비 기능 | `npm --prefix back run test:api -- --suite saved-videos` | 기본·잘못된 page, 빈 목록, 30/31개 경계, 후속·빈 페이지, limit 무시, 정렬·중복 방지·공개 조건·JWT 격리·저장/삭제와 조회 플래그 보존 |

공통 페이징의 유일한 소비자는 저장 영상이다. 다른 endpoint, 공통 인증·에러 처리, DB 설정을 수정하지 않으므로 task 검증은 저장 영상 suite와 기존 내부 경계 테스트로 한정한다. HTTP로 재현 가능한 페이징 로직을 위한 별도 단위 테스트를 추가하지 않는다. task-1 build는 아직 소비자가 연결되지 않은 공통 모듈의 컴파일 검증이며, 런타임 완료 판정은 task-2의 API 검증까지 통과해야 한다. 최종 `$finish-plan`은 task checks와 백엔드 전체 lint·test·build를 수행한다.

API 검증 전 `http://localhost:3000/`에 HTTP 요청하여 기존 서버의 연결을 확인한다. 변경된 공통 페이징 모듈과 저장 영상 소스가 해당 개발 서버에 반영됐는지도 확인한다. 반영 여부를 확인할 수 없으면 사용자에게 확인하며, 임의로 다른 서버를 띄우지 않는다. 연결 실패 또는 필수 콘텐츠·서명 설정 부족은 검증 실패다. 서버가 없으면 `npm --prefix back run start:dev` 실행을 안내한다.

`back/test/api/README.md`의 개발 DB 설정과 공개 콘텐츠·컬렉션·개발 S3 서명 설정을 전제로 한다. 비밀 값을 출력하거나 계획·컬렉션에 넣지 않는다. DB reset이나 seed 실행은 하지 않는다.

## 완료 조건과 계획 검증

- 두 task의 코드·문서 수정이 지정 파일 범위에 있고, 공통 로직에 DB·저장 영상 도메인 의존성이 없다.
- 기존 외부 API 계약과 저장 영상 동작을 유지하며 선언한 검증이 모두 통과한다.
- task 문서의 핵심 구현 예시, 호출 지점, 허용 파일·검증·완료 조건을 직접 대조한다.
- 계획 생성 후 `node tools/harness/cli.mjs validate --plan plan-48-common-pagination`으로 인덱스를 검증한다.
- 계획 생성 시 제품 검증은 실행하지 않는다. 제품 검증 결과는 이후 `$harness` 실행 시 기록한다.
