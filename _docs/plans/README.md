# Plans

계획 스키마와 공통 task 규칙의 기준 문서다. 프로젝트 행동 지침은 [루트 AGENTS.md](../../AGENTS.md), 계획 승인·작성은 [harness-plan](../../.agents/skills/harness-plan/SKILL.md), 배정·재시도는 [harness](../../.agents/skills/harness/SKILL.md), 최종 검증·배포는 [finish-plan](../../.agents/skills/finish-plan/SKILL.md)을 따른다.

## 계획과 상태 구조

`_docs/plans/index.json`은 플랜 목록과 메타데이터만, `plan-N-name/index.json`은 해당 플랜의 task 상태만 관리한다. CLI는 두 레벨을 함께 검증한다. `web-prototype/`은 계획·실행·검증에서 제외한다.

- 루트 index: `version: 1`, `plans` 배열. 각 항목은 `id`, `directory`, `title`, `status`를 가진다. 상태는 `draft`, `active`, `completed`, `error`, `blocked`다. `tasks`는 넣지 않는다.
- 플랜별 index: `version: 1`, 루트 항목과 일치하는 `plan_id`, `tasks` 배열.
- task 필수 필드: `id`, `name`, `status`, `depends_on`, `files`, `checks`. 상태는 `pending`, `in_progress`, `completed`, `error`, `blocked`다.
- `depends_on`은 선행 task ID 배열, `files`는 정확한 repository-relative 수정 허용 파일 배열, `checks`는 worker가 실행할 검증 명령 배열이다. 검사에서 읽는 파일은 수정하지 않으면 `files`에 추가하지 않는다.
- `plan.md`는 목표·범위·비목표·공통 계약·task 요약·실행 순서를, `task-N-name.md`는 역할·입력·파일 경계·계약 발췌·작업·checks·완료 조건을 기록한다.

## 역할과 검증

| 작업 | 파일 소유권 | 완료 조건 |
| --- | --- | --- |
| 미구현 기능의 테스트 작성 | 테스트·fixture·필요한 테스트 실행기 변경 | 구현 없이 가능한 정적 검사와 계약·시나리오 검토 |
| 소스 구현 | 제품 코드·관련 제품/API 문서 | 선행 테스트 작성 task 이후 구현하고 해당 테스트·관련 회귀 검사 통과 |
| 기존 구현의 테스트 전용 작업 | 테스트·fixture·실행기 | 작성·수정한 테스트를 직접 실행하고 통과 |

역할은 task Markdown에 적으며 새 JSON 필드나 agent type은 만들지 않는다. 제품 변경과 테스트 변경이 함께 필요하면 `테스트 작성 → 소스 구현 및 실행`으로 분리하고 소스 task의 `depends_on`에 테스트 task를 선언한다. 기존 테스트로 충분한 변경·문서 작업·기존 구현의 테스트 전용 작업에는 빈 소스/테스트 task를 만들지 않는다.

미구현 기능의 작성 task는 동작 테스트나 unimplemented module을 로드하는 검사를 실행하지 않으며 예상 실패 실행도 요구하지 않는다. 적절한 정적 검사가 없으면 `checks: []`로 두되 imports·호출·fixture/mock·이벤트 순서·assertion을 계약과 실제 테스트 도구 API에 대조한다. 완료 요약에 계약 ID·검토 시나리오·실행할 소스 task를 기록한다. 작성 완료는 기능 통과가 아니다.

소스 task는 작성된 테스트와 관련 회귀 명령을 자신의 `checks`에 선언하고 모두 실행·통과해야 완료한다. 실행기 변경은 선택 실행과 무인자 전체 실행을 검증한다. 테스트 전용 task도 실행기 변경이면 동일하게 검사한다. 소스 worker는 범위 밖 테스트를 수정하거나 assertion을 약화하지 않고 테스트 결함을 근거와 함께 부모에게 보고한다.

백엔드 REST 변경은 같은 plan에서 API 문서와 Postman 컬렉션을 갱신한다. 컬렉션·fixture·실행기는 테스트 task, 제품 코드·API 문서는 소스 task가 맡는다. API suite 선택·데이터·lock·실패 판정은 [백엔드 검증](../../back/README.md#검증), 프론트 선택 실행은 [프론트 검증](../../front/README.md#검증)을 따른다. 백엔드는 HTTP 검사를 우선하고 HTTP로 안전하게 재현하기 어려운 내부 규칙·경계 조건만 단위 테스트로 검사한다. 테스트 위치는 루트 AGENTS.md를 따른다.

검사는 변경 동작과 영향받는 소비 기능을 포함한다. task마다 전체 검사를 반복하지 않으며, 영향을 좁힐 근거가 없으면 전체 검증과 이유를 선언한다. 문서·선언 변경도 내용에 맞는 검사를 둔다. 선언된 검사가 실패하거나 미실행이면 task를 완료하지 않는다.

## 읽기와 계약

메인은 전체 plan을 읽고 worker에게 자신의 task 문서·index 항목·적용 지침·관련 선행 결과를 전달한다. 필수 읽기는 계약·담당 파일·직접 의존 코드의 필요한 구간으로 제한한다. 이미 전달된 루트 AGENTS.md는 재조회하지 않고 누락·변경 시 확인한다. 요약으로 전달되지 않은 원문 지침을 대체하지 않는다.

구조·파일 책임 변경에는 ARCHITECTURE.md의 관련 부분을, 계약 누락·충돌에는 plan.md의 해당 계약을 참조한다. 확인 조건과 섹션을 적고 모든 worker에게 공통 문서 전체 재조회를 요구하지 않는다. 소스 task의 관련 테스트·fixture는 실패 시 참고 목록으로 둔다. 테스트 실행만을 위해 내부 전체 읽기를 요구하지 않는다.

공유 계약의 원본은 plan.md의 안정적인 계약 ID 섹션이다. task에는 필요한 정확한 시그니처·동작 발췌를 전달하며 원본과 대조한다. worker는 누락된 이름·props·동작을 추측하거나 계약을 임의 변경하지 않는다. 충돌 시 영향받는 작업을 보류하고 부모가 계약과 관련 task 입력을 일치시킨다. 승인 범위·동작이 바뀌면 재승인한다.

## 테스트 결함 수정

부모는 보고된 결함을 계약과 대조하고 영향받는 작업을 보류한다. 해당 worker들이 종료한 뒤 진행된 의존 task를 의존성 역순으로 먼저 `node tools/harness/cli.mjs reset --plan <id> --task <task-id>`하고, 완료된 테스트 task를 reset한다. CLI는 진행된 의존 task가 남아 있으면 선행 task reset을 거부한다.

기존 계약·파일 범위 내의 테스트 결함은 같은 테스트 task에 근거와 수정 지시를 전달해 다시 배정한다. 계약·동작·범위 변경은 관련 문서·입력을 갱신하고 재승인한다. 테스트 작성/검증 뒤 소스와 영향받는 후행 task를 순서대로 다시 실행한다. 소스 task를 수정 권한이 없는 테스트 결함으로 반복 재시도하지 않는다. 3회 실패로 blocked된 task는 harness의 사용자 확인 규칙을 따른다.

## 병렬 및 반복 작업 위임

병렬 작업은 수정 파일·생성 출력·fixture가 충돌하지 않을 때만 허용한다. 공유 파일은 `depends_on`으로 순서를 정한다. API content lock 대기는 runner에 맡기고 조정 밖에서 겹치는 검사를 시작하지 않는다.

각 task에 반복 작업 위임 허용 여부와 이유를 적는다. 별도 설계 판단 없이 확정된 패턴을 독립 파일에 반복 적용할 때만 메인(0) → `harness_worker`(1) → `harness_repeater`(2)를 허용한다. plan.md와 task 문서에 패턴·부모/자식의 정확한 분리 파일 목록·통합/검증 책임을 기록하며 자식 task나 JSON 필드는 만들지 않는다.

메인을 제외한 worker·자식 전체는 최대 5개다. 메인은 자식 슬롯을 예약해 명시적으로 배정하며 기본 배정은 0이다. 용량이 없으면 worker가 직접 작업한다. 부모 worker는 패턴을 확정한 뒤 자신의 files 안에서 겹치지 않는 파일을 배정하고 공통 파일을 맡는다. 다른 작업자의 수정을 보존하라고 자식에게 알리며 자식 작업 중 해당 파일을 동시에 수정하지 않는다.

자식은 재위임·task 상태 변경을 하지 않고 부모에게만 보고한다. `harness_worker`를 자식으로 사용하지 않는다. 그 stop hook은 task 전체 상태를 변경하기 때문이다. 부모는 모든 자식 결과를 통합하고 실패를 해결한 뒤 task checks를 실행해 하나의 최종 결과를 보고한다.

## Finish 검증

worker는 task별 관련 검사를 실행한다. finish는 커밋에 포함되는 변경 파일을 기준으로 프론트의 `typecheck/test/export`, 백엔드의 `lint/test/build`를 전체 실행한다. 양쪽 변경이면 양쪽을 검사하며, 백엔드 test는 단위 테스트와 전체 실제 HTTP suite를 포함한다.

일반 npm 검사는 전체 검증으로 대체해 task 명령을 따로 재실행하지 않는다. 대상은 프론트 `typecheck/test/export`, 백엔드 `lint/test/test:unit/test:api/build`의 무인자 명령과 정확한 테스트 파일·API suite 선택 명령이다. coverage 등 추가 옵션·별도 명령은 전체 검증에 포함된 것으로 추측하지 않는다.

task에 선언된 `test:api:parallel`, Harness 테스트, 별도 정적 검사처럼 전체 검증 밖의 명령은 파일 위치와 무관하게 유지하며 같은 명령 문자열은 한 번 실행한다. 일반 검사를 대체하는 선택 규칙은 CLI의 `collectFinishChecks`를 기준으로 한다. 검사 실패 시 commit/push 전에 중단한다. 게시와 제외 파일 처리는 finish-plan 스킬을 따른다.
