# plan-44-scoped-parallel-tests

## 목표

Harness 계획 작성부터 task가 변경한 기능과 영향받는 기능의 테스트를 선정해 실행하게 한다. 프론트는 테스트 파일을, 백엔드 API는 기능별 suite를 선택한다. 실행별 사용자·상태를 격리하고 공용 콘텐츠 변경을 조율해 독립적인 검증을 병렬 실행한다. 전체 제품 검증은 기존 finish 단계에서 유지한다.

사용자가 테스트 선택·fixture 격리 방향과 아래 세 task의 정확한 파일 범위·검증 명령을 승인했다. 응답 타입 분리 작업은 이 선행 계획 완료 후 별도 계획으로 진행하며 여기에는 포함하지 않는다. 사용자의 명시적 지시에 따라 계획 번호는 44를 사용하고 다른 작업의 plan-45는 보존한다.

### 범위와 전제

- 프론트 선택 실행, 백엔드 여덟 API suite의 독립 준비·검증·정리, 실행별 fixture, 공용 콘텐츠 shared/exclusive 잠금, 실제 병렬 검증, 관련 Harness 지침을 변경한다.
- task-1/2는 실행기 자체를 변경하므로 각각 전체 제품 회귀 검증을 수행한다. task-3 완료 후 작성하는 일반 제품 task는 관련 파일·suite 검증을 사용한다. 이 전환을 이유로 승인된 checks를 축소하지 않는다.
- 선택 인자 없으면 모든 테스트를 수행한다. 잘못된 선택·검사 없음·API 연결 실패·필수 데이터 부족·cleanup 실패는 비정상 종료다.
- 기본 API는 기존 http://localhost:3000과 그 서버의 MySQL이다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. 없다면 npm --prefix back run start:dev 안내 후 검증을 실패 처리한다.
- 공용 공개 콘텐츠는 원칙적으로 조회만 한다. 사용자·wallet·권한·저장·시청기록·인증 이력은 실행별 사용자에 귀속한다. 콘텐츠 생성·상태 변경이 필요한 saved-videos만 전용 콘텐츠와 exclusive 잠금을 사용한다.
- DB 초기화·시드 실행·기존 사용자 비밀번호/잔액 변경을 하지 않는다. 테스트가 생성한 데이터만 정확한 키로 정리한다.
- 제품 endpoint·인증·응답·DB 스키마, 새 의존성, 별도 API 서버/DB, Harness 인덱스 스키마·CLI 변경은 범위 밖이다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 프론트 테스트 선택 | front/scripts/test-front.cjs, front/tests/unit/testFrontRunner.test.ts, front/README.md | 명시한 파일만 컴파일·실행, 무인자 전체 실행, 잘못된 선택 실패, 출력 격리 |
| 2 | 백엔드 suite·fixture 격리 | back/package.json, back/test/api/ 실행기·네 helper·기존 및 여덟 기능별 컬렉션·README, back/test/unit/api/ 세 spec, _docs/ARCHITECTURE.md | 독립 suite, 실행별 데이터, 콘텐츠 잠금, 기존 시나리오 보존, 실제 병렬 검증 |
| 3 | Harness 정책 | AGENTS.md, front/AGENTS.md, _docs/plans/README.md, .agents/skills/harness-plan/SKILL.md, .agents/skills/harness/SKILL.md, .codex/agents/harness-worker.toml | task별 관련 검사·영향 범위, 병렬 조건, 최종 전체 검증 |

정확한 변경 허용 목록과 checks는 이 폴더 index.json과 각 task 문서에 동일하게 기록한다.

## 실행 순서 및 병렬 작업

- task-1은 depends_on: []이고 task-2와 병렬 실행 가능하다. 변경 파일과 테스트 출력·데이터 영역이 겹치지 않는다.
- task-2는 depends_on: []이고 task-1과 병렬 실행 가능하다. 한 worker가 백엔드 공통 실행기·컬렉션 이관을 소유한다.
- task-3은 depends_on: [task-1, task-2]다. 두 실행기에서 확인된 실제 명령과 격리 조건을 지침에 반영하므로 선행 task 모두 완료 후 실행한다.
- 순서는 (task-1 || task-2) → task-3이다. task-3과 그 선행 task 사이에는 병렬 실행이 없다.
- plan-45-saved-video-review-fixes의 task-1은 front/scripts/test-front.cjs, task-3은 기존 API 실행기·컬렉션·README를 수정한다. 해당 계획을 먼저 완료한 뒤 이 계획을 실행해야 기존 컬렉션 삭제와 선행 수정이 충돌하지 않는다. 인덱스 스키마는 계획 간 depends_on을 지원하지 않으므로 실행 전에 해당 선행 완료를 확인한다. 다른 계획의 상태·파일 범위를 이 계획에서 변경하지 않는다.
- 최신 변경을 읽고 다른 작업자의 변경을 보존한다. worker는 선언된 파일만 apply_patch로 수정하며 dev에서 branch·worktree·commit·push를 만들지 않는다.

## 검증

- task-1: front typecheck, test, export. 선택한 파일만 실행되는지와 무인자 전체 실행을 검증한다.
- task-2: back lint, test, build, test:api:parallel. 기본 실행은 여덟 suite를 순차 실행한다. 병렬 검증은 같은 suite 두 실행의 실제 중첩·별도 소유 키와 shared/exclusive 배제를 확인한다.
- task-3: 계획 인덱스 validate와 수정한 두 스킬 quick_validate. 문서와 worker 지침을 실제 실행기 명령·완료 기준과 대조한다.
- HTTP 동작은 Postman으로 검증한다. 선택·cleanup 소유권·잠금 같은 내부 규칙만 back/test/unit/api/에서 검사한다.
- 기존 시나리오는 이관표로 새 suite와 연결해 누락을 검토한다. 요청 수만으로 검증 보존을 판정하지 않는다.
- API 연결·현재 제품 코드·DB 구성을 확인한 뒤 실행한다. URL 서명 설정이 필요한 suite는 기존 설정을 사용하며 미디어 다운로드는 하지 않는다. 비밀값은 기존 환경 파일과 임시 Postman 환경에서만 관리한다.
- 계획 생성에서는 제품 검증을 실행하지 않는다. task 문서의 코드·범위·완료 조건을 재열람한 뒤 node tools/harness/cli.mjs validate --plan plan-44-scoped-parallel-tests를 실행한다.

## 현재 상태

- 범위 승인 완료, task 구성 승인 완료.
- 세 task는 pending이다. 제품 파일 수정·worker 배정·제품 테스트 실행은 하지 않았다.
- 세 task 문서를 재열람해 task-1/2의 핵심 코드·데이터 흐름과 task-3의 정확한 문서 변경 지시를 검토했다. 파일 목록(3/20/6개)과 checks가 index.json에 일치하며 병렬 task 사이 공유 변경 파일이 없음을 확인했다.
- node tools/harness/cli.mjs validate --plan plan-44-scoped-parallel-tests가 통과했다(valid: true). 계획 파일만 생성했으며 제품 검증은 실행 단계에서 수행한다.
