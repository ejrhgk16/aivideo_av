# plan-29-drama-episode-entitlements

## 목표
드라마 상세 API의 회차 조회에 사용자별 권한을 LEFT JOIN하고 공개 조건·회차 정렬을 DB에서 처리한다. 사용자에게 범위와 단일 task 구성의 두 단계 승인을 받았다.

## 범위와 가정
- GET /dramas/:dramaId에 선택 쿼리 userUuid를 추가한다. 현재 토큰·세션이 없으므로 개발용 사용자 식별 값이며 인증은 아니다.
- episodes[].isUnlocked는 무료 회차 또는 해당 사용자의 episode_entitlements 행이 있으면 true다. 권한 취득 종류를 제한하지 않는다.
- userUuid 생략 시 무료 true, 유료 false다. 제공된 값이 UUID 형식이 아니면 400, 존재하지 않는 사용자면 404다.
- 권한의 사용자·회차 조건은 LEFT JOIN의 ON에 둔다. 미보유 회차도 목록에 남으며 사용자·회차 고유 제약으로 중복 행을 만들지 않는다.
- 공개 상태 및 publishedAt <= now는 WHERE, episodeNumber ASC는 ORDER BY에서 처리한다.
- 기존 작품·장르·이미지·프리뷰 분리 조회는 유지한다. 사용자 존재 확인 조회는 허용하되 회차별 권한 추가 조회는 하지 않는다.

## 비목표와 영향 계층
백엔드 content 계층, API 문서, 테스트만 변경한다. 프론트 연결·재생 접근 제어·구매 로직·DB 스키마·마이그레이션·시드는 변경하지 않는다. 구조와 파일 책임은 유지하므로 ARCHITECTURE.md 변경은 필요 없다. 읽기 API 검증을 위한 DB 초기화·시드·구매·권한 지급은 수행하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | episode-entitlements | `back/src/content/publicCatalogController.ts`, `back/src/content/publicCatalogService.ts`, `back/src/content/content.module.ts`, `back/test/unit/content/publicCatalogService.spec.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/README.md`, `_docs/api/02-content/dramas.md`, `_docs/api/00-overview/conventions.md` | 선택 사용자, 권한 LEFT JOIN, DB 공개 필터·정렬, 응답·문서·테스트 갱신 |

## 실행 순서 및 병렬 작업
- task-1의 depends_on은 []다. 단일 task이므로 병렬 실행 대상은 없다.
- 구현과 해당 계약의 문서·테스트를 같은 task에서 완료한다.
- plan-28의 상태와 파일은 변경하지 않는다. plan-29 생성은 다른 plan의 완료 여부와 별개인 사용자 승인 작업이다.

## 검증과 완료 조건
- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
- test는 unit과 실제 개발 서버·MySQL 대상 Postman API 검증을 포함한다.
- HTTP로 localhost:3000 연결 및 현재 코드 반영을 확인한다. 불확실하면 사용자에게 확인한다.
- 서버 미실행은 실패이며 npm --prefix back run start:dev 실행을 안내한다. 서버 자동 실행·추가 서버·다른 포트 우회는 하지 않는다.
- 기존 데이터로 무료·보유·미보유·사용자 간 분리·회차 정렬·입력 오류를 검증한다. 필요한 기존 데이터가 없으면 실패로 보고한다.
- 기존 응답 필드·공개 회차 개수와 작품 비공개 처리 동작을 유지한다.

## 검증 결과
- task-1 구현 완료: 선택 userUuid, 권한 LEFT JOIN, DB 공개 필터·정렬, isUnlocked 응답, API 문서 및 테스트 갱신.
- lint 및 build 통과. 기존 DB fixture를 외부 Postman 변수로 전달한 전체 테스트에서 단위 테스트 68개와 API assertion 127개 통과. DB 쓰기는 수행하지 않았다.
- finish의 기본 test 명령에 fixture 인자가 누락되어 실패한 뒤, 사용자 수정 요청에 따라 컬렉션 변수에 기존 개발 fixture UUID 기본값을 추가했다. 환경 변수로 덮어쓸 수 있고, 실제 데이터가 부족하거나 권한이 다르면 검증은 실패한다. plan-local checks도 기본 test 명령으로 통일했다. 이 값은 비밀 값이 아니며 DB 데이터가 바뀌면 기존 레코드에 맞게 갱신해야 한다.
