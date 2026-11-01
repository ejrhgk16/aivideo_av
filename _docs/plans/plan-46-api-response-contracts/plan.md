# plan-46-api-response-contracts

## 목표

성공 HTTP 응답을 현재와 동일하게 유지하면서 백엔드 오류 응답을 전역 통일하고, 백엔드·프론트 API 응답 타입과 프론트 오류 처리를 정리한다. 성공 응답에 `data` envelope를 추가하지 않는다.

사용자의 "다 포함해서 플랜생성해, data 감싸는건빼고, 기존응답이랑 동일한지에대한 엄격한 테스트 포함" 요청을 앞서 논의한 범위의 확정 및 계획 생성 승인으로 반영한다. 추가 승인 대기로 계획 생성을 멈추지 않는다. 이 단계에서는 계획 파일만 생성하며 제품 구현·API 테스트·worker 실행·Git 명령은 수행하지 않는다.

## 범위와 설계 결정

- 성공 응답의 JSON 최상위 배열/객체, 모든 중첩 필드, 필드명, 타입, nullable/optional 구분, 값·정렬·공개/권한/저장 의미를 보존한다. `GET /`의 `Hello World!` 텍스트와 기존 HTTP 상태도 그대로 유지한다.
- `204` 응답과 OPTIONS/HEAD의 본문 없음, 인증의 `Cache-Control: no-store`, 네이티브 JSON/웹 HttpOnly 쿠키 전송 방식을 보존한다.
- 응답 객체는 이름 있는 `type`으로 정의한다. 백엔드 각 도메인에 응답 타입 파일을 두며 API 반환 메서드는 `Promise<응답타입>`, 목록은 `Promise<항목응답[]>`, 본문 없는 비동기 메서드는 `Promise<void>`를 명시한다. 이미 명시된 동기 `string` 응답은 유지한다.
- 프론트도 기능별 응답 타입 파일을 사용한다. 기존 UI의 타입 import는 type 재수출/alias로 유지하고 API 관련 응답 interface만 type으로 정리한다. 서비스 내부 DB 행, 컴포넌트 props, 플레이어 인터페이스, 요청 타입 전체를 일괄 변환하지 않는다.
- 백엔드 오류는 `{ errorCode, errorName, statusCode, timestamp, path }`의 정확히 다섯 필드로 전역 통일한다. 기존 BaseException의 errorCode/errorName/HTTP status는 그대로 유지한다.
- 일반 HttpException은 기존 HTTP 상태를 유지하며 `HTTP_BAD_REQUEST`, `HTTP_UNAUTHORIZED`, `HTTP_FORBIDDEN`, `HTTP_NOT_FOUND`, `HTTP_CONFLICT` 등으로 매핑한다. errorName은 해당 HTTP enum 이름(BAD_REQUEST 등)으로 고정한다. 500은 `INTERNAL_SERVER_ERROR / InternalServerError`다. 다른 HTTP 5xx는 해당 상태와 `HTTP_<HTTP enum 이름>`을 유지한다. 새 공통 코드 정의는 task-3 및 task-4가 공유하는 확정 계약이다.
- 일반 오류의 기존 NestJS `message/error` 필드는 의도적으로 공통 다섯 필드로 전환한다. 성공 응답/기존 업무 오류와 이 변경을 섞어 "전부 기존과 동일"이라고 보고하지 않는다. 잘못된 JSON 요청처럼 Express body parser가 만드는 HTTP 오류도 기존 400 등을 보존한다.
- 프론트 오류 본문 파싱을 공통 함수로 모으고 `알려진 코드 안내 → HTTP 상태별 안내 → 일반 안내` 순서로 처리한다. HTTP 응답 status를 신뢰하며 본문의 statusCode로 덮어쓰지 않는다.
- `401 + AUTH_INVALID_TOKEN`인 인증 요청의 한 번 Refresh·한 번 재시도·세션 만료만 유지한다. 일반 HTTP_UNAUTHORIZED/403/5xx로 Refresh하지 않는다.

## 비목표

DB/Entity/마이그레이션/쿼리/업무 로직, 경로·메서드·권한 정책, 전역 URL prefix, 새 페이지네이션 규격, UI 개편, 신규 의존성, Swagger·런타임 DTO 검증기, 별도 공유 패키지, 테스트 실행기 변경은 범위 밖이다. 기존 성공 응답 mock을 새 형식으로 일괄 수정하지 않는다. `web-prototype/`은 읽기·수정·검증 대상이 아니다.

## Task

기존 task-1/2/3/4 ID를 유지하고, 원래 task-2의 제품 구현을 task-5/6/7/8/9로 분리했다. 아래 표는 번호순이 아니라 실행 순서다.

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 기존 응답 계약 고정 | 8개 Postman 컬렉션, API 테스트 README, 응답 호환성 문서 | 제품 변경 전 strict baseline 확정 |
| 5 | 콘텐츠 응답 type | contentResponses.ts, publicCatalogService/Controller | 장르·목록·상세·본편·프리뷰 반환 선언 |
| 6 | 홈 컬렉션 응답 type | programmingResponses.ts, publicCollectionService/Controller | 홈 4종 응답 선언·서로 다른 필드 구조 보존 |
| 7 | 인증 응답 type | identityResponses.ts, loginService/Controller, tokenService, refreshCookie | native/web/익명204 차이와 명시적 Promise |
| 8 | 포인트·구매 응답 type | pointResponses.ts, pointService/Controller | 잔액·차감·멱등성·nullable 보존 |
| 9 | 저장 영상 응답 type | savedVideoResponses.ts, savedVideoService/Controller | 저장 유니언·목록·void 반환 선언 |
| 2 | 백엔드 통합 문서·검증 | Architecture 및 도메인 타입 연결 지점 | 5개 도메인 완료 후 문서·type import 연결·build·6개 HTTP suite |
| 3 | 전역 오류 처리 | 공통 오류·AppModule·컨트롤러, API 문서·컬렉션, 최소 내부 테스트 | 전역 Filter, 기존 성공·업무 오류 보존 |
| 4 | 프론트 응답·오류 처리 | 기능별 응답 파일, 공통 HTTP·Refresh·메시지, 관련 테스트 | type·공통 파서·오류 안내·소비 기능 회귀 |

각 task의 정확한 수정 허용 `files`, `depends_on`, `checks`는 이 폴더 `index.json`과 해당 task 문서를 따른다. 실행만 하는 기존 테스트는 수정 허용 목록에 넣지 않는다.

## 실행 순서 및 병렬 작업

- task-1은 의존성 없이 먼저 단독 실행한다. 기존 제품의 응답 기준을 고정하기 전에는 어떤 제품 변경 task도 실행하지 않는다.
- task-5/6/7/8/9는 각각 task-1에만 의존하며 서로 편집 파일이 겹치지 않는 5개 병렬 후보다. Harness worker는 최대 3개씩 실행하므로 3개 작업 후 빈 slot에 나머지를 배치할 수 있다.
- 병렬 도메인은 신규 응답 파일을 다른 도메인과 공유하지 않으며, 기존 Entity·mediaUrl 등 변경되지 않는 의존성만 함께 읽는다. 내부 테스트 파일도 서로 다르다. 각 단위 테스트는 `--no-cache`를 사용해 공통 Vitest results.json 쓰기를 끄고 coverage/report/snapshot을 생성하지 않는다.
- task-2는 task-5/6/7/8/9 모두 완료된 후 실행한다. Architecture를 한 곳에서 갱신하고 전체 도메인 선언의 컴파일·HTTP 소비를 검증한다. 제품 파일의 쓰기 권한은 통합 과정에서 발견한 type import/export·반환 선언 연결 오류를 고치는 용도로만 유지한다.
- back build는 task-2에서 단독 실행해 dist/tsbuildinfo 쓰기 충돌을 피한다. 병렬 도메인 편집 중에는 서버 watcher의 일시적 컴파일 상태를 API 실패로 오인하지 않도록 전체 build/tsc/HTTP suite를 실행하지 않는다.
- task-3과 task-4는 task-2 완료 후 병렬 실행 가능하다. task-3은 back/ 및 API 문서, task-4는 front/만 수정한다. 오류 코드·다섯 필드 계약은 이 계획에서 확정되어 있다.
- task-1과 task-3의 컬렉션·호환성 문서, 도메인 task와 task-2/3의 컨트롤러, task-2와 task-3의 Architecture는 의존성으로 순차 편집한다.
- task-3의 API 검증은 기존 서버/MySQL·content lock·run-owned fixture를 사용한다. task-4의 fetch mock 테스트는 DB/API fixture를 사용하지 않는다. front typecheck와 back API 검증은 공통 산출물이 없다.
- API suite는 기존 실행기의 순서·lock·실행별 임시 컬렉션/환경·fixture 소유권을 유지한다. 병렬화 때문에 실행기/DB/lock을 수정하지 않는다.

`task-1 → [task-5 ∥ task-6 ∥ task-7 ∥ task-8 ∥ task-9] → task-2 → [task-3 ∥ task-4]`

## 엄격한 응답 보존 기준

1. 제품 수정 전 task-1의 강화된 HTTP 테스트를 현재 서버에서 먼저 통과시키고 결과를 기록한다. 변경 뒤 반환값을 보고 기대값을 새로 작성하는 순서를 금지한다.
2. 모든 응답 객체를 중첩 깊이까지 정확한 키 집합으로 검사한다. `additionalProperties: false`와 모든 현재 필드의 `required`를 사용하거나 같은 강도의 정확한 키 검사를 적용한다. `include`/일부 필드 존재/2xx만으로 보존을 판정하지 않는다.
3. 문자열↔숫자, boolean↔0/1, null↔생략, 배열↔객체, 내부 id 노출, data wrapper 추가가 모두 실패해야 한다. productionCompany가 홈에서 객체이고 catalog/detail에서 문자열인 차이, episodeCount와 publishedEpisodeCount도 그대로 고정한다.
4. 값·순서는 기존 fixture UUID와 연관 응답을 기준으로 검증한다. 저장 전후 플래그, 사용자의 권한·가격·잔액·차감액, 시청기록, 저장 목록 page/hasNext/정렬/0·30·31 경계의 기존 의미 검사를 유지한다.
5. JWT·서명 URL·생성 UUID·응답 시각처럼 실행마다 달라지는 값은 비트 단위 동일 비교 대상이 아니다. 해당 필드만 발급/회전/기간/주체/저장키/요청 시각 구간 등 기존 의미를 검증한다. 토큰·서명 URL 전체를 제거한 뒤 나머지만 비교하거나 모든 값 차이를 허용하지 않는다. 민감한 원문을 baseline 파일이나 실패 로그에 출력하지 않는다.
6. 기존 업무 오류는 다섯 키 및 errorCode/errorName/statusCode/path가 동일하고 timestamp만 유효한 UTC 시각인지 검사한다. 일반 오류는 task-3에 열거한 의도된 변경만 허용하며 HTTP status·인증 정책·헤더는 보존한다.
7. JSON 객체 키 순서는 계약이 아니므로 비교하지 않고 배열 순서는 비교한다. 시시각각 변하는 공개 예약·콘텐츠 차이는 무시하지 말고 환경/fixture 불안정으로 실패시킨다.
8. 강화한 assertion이 추가/삭제/타입변경/null생략/wrapper/배열순서 변조를 실제로 거부하는지 로컬 응답 복사본으로 부정 검증한다. DB나 API 응답을 변조하지 않는다. 성공 계약 assertion은 task-2/3에서 느슨하게 바꾸거나 제거하지 않는다.

## 기능별 검증 매핑

| 기능 | 검증 | 영향 근거 |
| --- | --- | --- |
| Root·CORS·미등록 경로·잘못된 JSON | http suite | 전역 오류 처리와 상태·본문·CORS 보존 |
| 로그인·Refresh·logout·웹 쿠키 | identity suite, loginController/refreshCookie/tokenService 내부 테스트, front api/session/login | 오류 코드와 응답 타입/쿠키 유무/갱신 회귀 |
| 장르·목록·상세·네 홈 컬렉션 | content/programming suites, front dramaContent/homeContent | 중첩 응답·정렬·서로 다른 필드 구조 보존 |
| 본편·프리뷰·권한 | playback suite, front episodePlayback/previewPlayback | 정확한 재생 필드와 401/403/404 의미 |
| 포인트·구매 | economy suite, pointController 내부 테스트, front episodePurchase/episodeUnlockDialog | 잔액·멱등성·구매·오류 안내 보존 |
| 시청기록 | watch-progress suite, front watchProgress | 204 빈 본문·완료/UTC·5xx 재시도 소비 |
| 저장 | saved-videos suite, front savedVideos | PUT/DELETE 204, 페이지·유니언·플래그·사용자 격리 |
| 공통 오류·안내 | errorFilter 내부 테스트, front api/errorMessages/session 및 화면 소비 테스트 | 미지 코드·비JSON·상태 fallback·Refresh 제한 |

전역 필터는 모든 HTTP API에 영향을 주므로 task-1/3은 8개 suite 전체를 선택한다. task-5/6/7/8/9는 각 도메인의 기존 내부 테스트를 캐시 없이 선택하고, task-2는 5개 결과가 모두 모인 뒤 타입이 이동하는 6개 suite와 백엔드 컴파일을 한 번 통합 실행한다. task-4는 공통 HTTP를 사용하는 모든 기능의 정확한 테스트 파일과 typecheck를 선택한다. 내부 테스트의 새 추가는 기존 개발 데이터를 깨거나 오류 유도용 endpoint를 만들지 않고 재현하기 어려운 500/503·프레임워크 오류 객체 처리 경계에 한정한다. 일반 HTTP 동작은 Postman으로 검사한다.

## 실행 환경과 검증 명령

- API 테스트는 기존 `http://localhost:3000` 서버가 현재 코드를 반영하는지 HTTP로 확인한 뒤 실행한다. 포트·프로세스 목록만으로 판단하지 않는다. 반영 여부가 불분명하면 사용자에게 확인한다.
- 서버가 없으면 검증 실패로 기록하고 `npm --prefix back run start:dev`를 안내한다. 에이전트가 서버를 시작하거나 다른 포트로 우회하지 않는다. 프론트 서버가 필요한 추가 확인에서 8081이 없으면 `npm --prefix front run start -- --port 8081`을 안내한다.
- `back/test/api/README.md`의 기존 데이터 및 S3 서명 설정이 필요하다. MySQL reset/seed, 기존 사용자·잔액·콘텐츠 수정은 하지 않는다. 기존 실행기가 생성한 run-owned fixture만 정리한다. 미디어 서명 URL을 다운로드하지 않는다.
- 검증 명령은 각 task에 정확히 기재한다. 테스트 실행기는 수정하지 않으므로 실행기 선택/발견 기능을 위한 별도 전수 실행을 추가하지 않는다.
- 이후 사용자가 명시적으로 `$finish-plan`을 호출하면 변경된 front의 typecheck/test/export, back의 lint/test/build 전체를 실행한다. `$harness` 단계에서는 commit/push하지 않는다.

## 계획 검증 결과

- 2026-11-02: 새 task 문서 4개를 파일에서 다시 열어 주요 로직/선언 예시, 수정 허용 files, checks, 완료 조건과 의존성을 직접 검토했다.
- `node tools/harness/cli.mjs validate --plan plan-46-api-response-contracts` 실행 결과 `valid: true`, 종료 코드 0을 확인했다.
- 계획 파일만 생성했다. 제품 구현·API 테스트·프론트 테스트·worker 실행은 수행하지 않았다. 실제 구현 전후 호환성 통과는 향후 task-1/2/3 실행 결과로만 판정한다.
- 병렬화 보완: task-2의 도메인 구현을 task-5/6/7/8/9로 분리해 총 9개 task로 변경했다. 새 문서 5개와 task-2 통합 문서를 다시 열어 선언 변경의 정확한 내용·files·checks·완료 조건을 검토했다. 공통 build와 HTTP 검증은 task-2로 모으고 병렬 내부 테스트는 결과 캐시를 비활성화했다.
- 보완 후 같은 validate 명령을 재실행해 `valid: true`, 종료 코드 0을 확인했다. 실행 상태는 모두 pending이며 제품 작업은 시작하지 않았다.
