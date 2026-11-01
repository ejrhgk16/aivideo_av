# task-3-harness-scoped-policy

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/README.md
- _docs/plans/plan-44-scoped-parallel-tests/index.json
- .agents/skills/harness-plan/SKILL.md
- .agents/skills/harness/SKILL.md
- .agents/skills/finish-plan/SKILL.md
- .codex/agents/harness-worker.toml
- tools/harness/cli.mjs의 validateTasks, completeTask, finishPlan
- front/scripts/test-front.cjs
- front/README.md
- back/test/api/README.md
- back/test/api/suites.mjs
- back/test/api/contentLock.mjs
- C:/Users/jdh/.codex/skills/.system/skill-creator/SKILL.md

## 작업

task-1과 task-2가 모두 완료된 뒤 검증된 선택 명령·병렬 조건을 계획·worker 지침에 반영한다. 새 실행 로직은 없으며 문서와 worker 지시문만 수정한다. 다른 작업자의 변경을 되돌리지 않고 다음 여섯 파일만 apply_patch로 수정한다.

### 변경 허용 파일

~~~text
AGENTS.md
front/AGENTS.md
_docs/plans/README.md
.agents/skills/harness-plan/SKILL.md
.agents/skills/harness/SKILL.md
.codex/agents/harness-worker.toml
~~~

### 정확한 변경 기준

1. AGENTS.md의 Test placement·API 테스트에서 일반 제품 task마다 전체 백엔드 lint/test/build를 요구하는 부분을 다음 정책으로 바꾼다. 테스트 위치, 실제 HTTP 우선, API 정의서·관련 컬렉션의 동일 task 갱신, 서버·비밀값 규칙은 유지한다.

   각 task의 checks에는 변경 기능과 영향받는 기능을 검증하는 정확한 테스트 파일·API suite를 선언한다. 일반 제품 task에서 전체 테스트·build·export를 관성적으로 반복하지 않는다. 공통 모듈·계약 변경은 실제 소비 기능도 검사하고, 영향 범위를 좁힐 근거가 없으면 전체 검증을 선택하며 이유를 기록한다. 최종 finish는 변경 프론트의 typecheck/test/export와 백엔드의 lint/test/build를 수행한다. 실행기 자체 변경은 선택·전체 실행 회귀 검증을 포함한다.

2. front/AGENTS.md의 현재 experience.test.ts 하나만 실행한다는 오래된 설명을 실제 계약으로 교체한다. 무인자 전체 발견·정확한 파일 인자 선택, task별 관련 검사, 최종 전체 검증을 기록한다. Expo 문서·테스트 위치 규칙은 보존한다.

3. _docs/plans/README.md의 checks 설명과 REST 변경 task의 전체 명령 강제 문구를 같은 정책으로 바꾼다. files는 수정 허용 목록이며 읽기 전용으로 실행하는 기존 테스트를 files에 억지로 추가하지 않는다고 명시한다. 상태 스키마·과거 completed plan은 변경하지 않는다.

4. harness-plan/SKILL.md의 REST 검증 지침을 기능별 명령 선정으로 교체한다. 계획에는 테스트와 기능의 연결·영향 범위 근거·데이터 및 출력의 병렬 조건을 적는다. 문서·선언만 변경하면 그 변경에 맞는 checks를 선정한다. 공유 파일은 의존성으로 순차화한다. 명시적 호출·두 단계 승인·파일 경계·생성 후 validate는 유지한다.

5. harness/SKILL.md에는 worker가 선언된 기능별 checks를 실행하고 다른 범위의 전체 검증으로 임의 대체하지 않는다고 적는다. 독립 프론트 출력·기본 백엔드 실행별 fixture를 근거로 병렬 실행하고 콘텐츠 잠금·외부 환경 exclusive 조건을 따른다. 잠금 대기·서버 부재·실행하지 않은 검사를 통과로 보고하지 않는다. 재시도·최대 세 worker·명시적 finish는 유지한다.

6. harness-worker.toml의 developer_instructions에 같은 관련 테스트·영향 기능·실패 보고 기준을 간결하게 반영한다. 모델·reasoning effort·결과 JSON·파일 경계·test-first는 변경하지 않는다.

### 주요 로직 코드 또는 변경 예시

새 로직은 없다. 계획에 기록할 명령 예시는 아래처럼 정확한 파일·suite를 지정한다. 실제 선정은 각 변경의 영향 범위에 따라 판단한다.

~~~text
# 프론트 저장 API만 변경하는 task의 관련 테스트 예
npm --prefix front run test -- tests/unit/savedVideos.test.ts

# 백엔드 저장 내부 규칙과 실제 API의 관련 테스트 예
npm --prefix back run test:unit -- test/unit/playback/savedVideoService.spec.ts
npm --prefix back run test:api -- --suite saved-videos

# 여러 API에 영향을 주는 인증 변경의 suite 선택 예
npm --prefix back run test:api -- --suite identity --suite playback --suite saved-videos
~~~

예시를 모든 task의 고정 세트로 만들지 않는다. API suite에 로그인 bootstrap이 있다는 이유만으로 identity 전체 시나리오를 항상 추가하지 않는다. 반대로 공통 인증을 수정하며 소비 기능 검증을 생략하지 않는다. build/export는 공유 출력물을 만들므로 일반 병렬 task에 무조건 추가하지 않는다. 출력 없는 타입·정적 검사가 필요하면 실제 지원 명령과 캐시 공유 여부를 확인해 선정한다.

현재 finishPlan은 제품 task의 checks를 모아 중복 명령을 제거하고 변경 제품의 전체 명령도 추가한다. task의 선택 검사가 finish에서 재실행될 수도 있다. 최종 단계가 전체 명령만 한 번 실행한다고 잘못 문서화하지 않는다. CLI·finish 스킬·완료 시 자동 검증 증명 기능은 추가하지 않는다.

### 검증 명령

~~~text
node tools/harness/cli.mjs validate --plan plan-44-scoped-parallel-tests
python C:/Users/jdh/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/harness-plan
python C:/Users/jdh/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/harness
~~~

quick_validate에서 Python·PyYAML 환경 문제가 발생하면 실패 원인을 보고한다. 성공으로 간주하거나 의존성을 임의 추가하지 않는다. 필요하면 기존 Python UTF-8 환경에서 실행하되 파일·패키지 변경으로 우회하지 않는다. 여섯 파일을 task-1/2의 실제 명령·서버 조건·실패 처리·최종 검증과 대조한다. 문구 일치만 검사하는 테스트는 추가하지 않는다.

### 완료 조건

계획 작성부터 worker 완료까지 task별 관련 검사 정책이 여섯 파일에서 일치한다. 기존 승인·경계·재시도·최종 검증을 보존한다. 지원하지 않는 명령·과도한 병렬 보장·CLI가 하지 않는 자동 검증을 문서화하지 않는다. 세 checks가 통과하며 제품 코드를 수정하지 않는다.
