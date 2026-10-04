# Plans

작업 계획과 실행 상태를 이 디렉터리에 기록한다. `web-prototype/`은 Harness 계획·실행·검증 범위가 아니다.

`index.json`은 두 레벨로 나뉜다. `_docs/plans/index.json`은 플랜 목록과 플랜 메타데이터만 관리하며, 각 `plan-N-name/index.json`이 해당 플랜의 task 상태를 관리한다. CLI는 두 파일을 함께 읽어 검증한다.

루트 플랜 항목은 `id`, `directory`, `title`, `status`를 가진다. 플랜별 index는 `version`, `plan_id`, `tasks`를 가지며 task마다 다음 필드를 반드시 선언한다.

- `id`, `name`, `status` (`pending`, `in_progress`, `completed`, `error`, `blocked`)
- `depends_on`: 선행 task ID 배열
- `files`: 정확한 repository-relative 변경 파일 배열
- `checks`: worker와 finish가 실행할 검증 명령 배열

`plan-N-name/plan.md`에는 목표·범위·비목표·승인된 task 상세·검증 결과를 기록한다. 병렬 task는 파일 목록이 겹치지 않을 때만 허용한다. task 상태 변경은 플랜 폴더의 `index.json`에 기록하며 루트 index에는 플랜 상태만 기록한다.

새 제품 테스트는 `front/tests/**/*.test.ts(x)`, `back/test/unit/**/*.spec.ts`에만 둘 수 있다. Harness CLI·hook 테스트만 `tools/harness/**/*.test.mjs`에 둔다. 최상위 `tests/` 폴더는 만들지 않는다.

계획은 `$harness-plan`의 두 단계 승인 후 생성한다. `$harness`는 worker를 최대 3개까지 실행하지만 commit/push하지 않는다. worker 오류는 `node tools/harness/cli.mjs retry --plan <id> --task <id>`로 같은 task를 재시도하며, 3회 연속 실패하면 `blocked`로 중단한다. 전체 완료 후에만 `$finish-plan`이 `node tools/harness/cli.mjs finish`로 검증·단일 commit·`origin/dev` push를 수행한다. `--message`를 생략하면 현재 완료하는 plan의 `id`를 사용해 `chore(harness): finish <plan-id>` 커밋명을 만든다.
