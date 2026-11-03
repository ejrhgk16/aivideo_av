# Plans

작업 계획과 실행 상태를 이 디렉터리에 기록한다. `web-prototype/`은 Harness 계획·실행·검증 범위가 아니다.

`index.json`은 두 레벨로 나뉜다. `_docs/plans/index.json`은 플랜 목록과 플랜 메타데이터만 관리하며, 각 `plan-N-name/index.json`이 해당 플랜의 task 상태를 관리한다. CLI는 두 파일을 함께 읽어 검증한다.

루트 플랜 항목은 `id`, `directory`, `title`, `status`를 가진다. 플랜별 index는 `version`, `plan_id`, `tasks`를 가지며 task마다 다음 필드를 반드시 선언한다.

- `id`, `name`, `status` (`pending`, `in_progress`, `completed`, `error`, `blocked`)
- `depends_on`: 선행 task ID 배열
- `files`: 정확한 repository-relative 변경 파일 배열
- `checks`: worker와 finish가 실행할 검증 명령 배열

`plan-N-name/plan.md`에는 목표·범위·비목표·승인된 task 상세·검증 결과를 기록한다. 병렬 task는 파일 목록이 겹치지 않을 때만 허용한다. task 상태 변경은 플랜 폴더의 `index.json`에 기록하며 루트 index에는 플랜 상태만 기록한다.

각 `task-*.md`에는 반복 작업 위임의 허용 여부와 이유를 명시한다. 같은 수정 패턴을 별도 설계 판단 없이 독립된 파일에 적용하는 경우에만 메인(0뎁스) → `harness_worker`(1뎁스) → `harness_repeater`(2뎁스)를 허용한다. 허용 시 수정 패턴·부모와 하위 에이전트의 겹치지 않는 정확한 파일 목록·부모의 통합 및 검증 책임을 기록하고, `plan.md`의 실행 순서에도 대상 task와 동시 실행 예산을 적는다. 부모는 패턴을 확정한 뒤 task의 `files` 안에서 파일을 배정하고 공통 파일은 직접 맡는다. 하위 에이전트는 배정 파일을 수정하고 부모에게만 결과를 보고하며 재위임·task 상태 변경은 하지 않는다. 부모가 모든 하위 작업 종료 후 결과를 통합하고 선언된 checks를 실행해 최종 결과를 보고한다. 하위 작업은 기존 task 내부의 분담이므로 별도 task나 JSON 필드를 추가하지 않는다.

새 제품 테스트는 `front/tests/**/*.test.ts(x)`, `back/test/api/**/*.postman_collection.json`, `back/test/unit/**/*.spec.ts`에 둔다. 백엔드는 HTTP API 테스트를 우선하고, 내부 규칙과 기존 데이터 변경 없이 재현하기 어려운 경계 조건만 단위 테스트로 유지한다. Harness CLI·hook 테스트만 `tools/harness/**/*.test.mjs`에 둔다. 최상위 `tests/` 폴더는 만들지 않는다.

백엔드 REST 동작 변경 task는 API 문서와 관련 Postman 컬렉션을 수정 파일인 `files`에 함께 선언한다. `checks`에는 변경 기능과 영향받는 기능을 검증할 정확한 API suite와 필요한 내부 테스트를 선언한다. `files`는 수정 허용 목록이므로 읽기 전용으로 실행하는 기존 테스트 파일을 추가하지 않는다. 일반 제품 task에서 전체 lint/test/build를 반복하지 않는다. 공통 모듈·계약 변경은 실제 소비 기능도 검사하고 영향 범위를 좁힐 근거가 없으면 전체 검증과 이유를 기록한다. 최종 `$finish-plan`은 task별 checks와 변경 제품의 전체 검증을 수행하므로 일부 선택 검사가 다시 실행될 수 있다. `npm --prefix back run test`는 단위 테스트와 실제 HTTP API suite 전체를 실행한다. API 검증은 현재 코드를 반영한 기존 개발 서버와 그 서버의 MySQL 데이터를 사용하며, 실행 전제와 데이터 조건은 `back/test/api/README.md`를 따른다. 서버 연결 실패나 필수 데이터 부족은 실패로 보고한다.

계획은 `$harness-plan`의 두 단계 승인 후 생성한다. `$harness`는 메인을 제외한 부모 worker와 하위 에이전트 전체를 최대 5개까지 실행하지만 commit/push하지 않는다. 메인이 하위 호출 슬롯을 예약·배정하고, 슬롯이 없으면 worker가 직접 수행한다. worker 오류는 `node tools/harness/cli.mjs retry --plan <id> --task <id>`로 같은 task를 재시도하며, 3회 연속 실패하면 `blocked`로 중단한다. 전체 완료 후에만 `$finish-plan`이 `node tools/harness/cli.mjs finish`로 검증·단일 commit·`origin/dev` push를 수행한다. `--message`를 생략하면 현재 완료하는 plan의 `id`를 사용해 `finish <plan-id>` 커밋명을 만든다.
