# Plans

작업 계획과 실행 상태를 이 디렉터리에 기록한다. `web-prototype/`은 Harness 계획·실행·검증 범위가 아니다.

`index.json`은 CLI가 읽는 상태 파일이다. 각 plan은 `plan-N-name/` 디렉터리와 같은 `id`, `directory`, `status`, `tasks`를 가지며 task마다 다음 필드를 반드시 선언한다.

- `id`, `name`, `status` (`pending`, `in_progress`, `completed`, `error`)
- `depends_on`: 선행 task ID 배열
- `files`: 정확한 repository-relative 변경 파일 배열
- `checks`: worker와 finish가 실행할 검증 명령 배열

`plan-N-name/plan.md`에는 목표·범위·비목표·승인된 task 상세·검증 결과를 기록한다. 병렬 task는 파일 목록이 겹치지 않을 때만 허용한다.

새 제품 테스트는 `front/tests/**/*.test.ts(x)`, `back/test/unit/**/*.spec.ts`에만 둘 수 있다. Harness CLI·hook 테스트만 `tools/harness/**/*.test.mjs`에 둔다. 최상위 `tests/` 폴더는 만들지 않는다.

계획은 `$harness-plan`의 두 단계 승인 후 생성한다. `$harness`는 worker를 최대 3개까지 실행하지만 commit/push하지 않는다. 전체 완료 후에만 `$finish-plan`이 `node tools/harness/cli.mjs finish`로 검증·단일 commit·`origin/dev` push를 수행한다. `--message`를 생략하면 현재 완료하는 plan의 `id`를 사용해 `chore(harness): finish <plan-id>` 커밋명을 만든다.
