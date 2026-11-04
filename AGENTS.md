# 프로젝트 작업 지침

프로젝트 행동 지침은 이 파일에서만 관리한다. 하위 프로젝트의 AGENTS.md는 만들지 않는다. 스킬 패키지 내부 지침은 해당 패키지 범위에서 유지한다.

## 작업 원칙

- 요구사항·외부 계약·데이터 손실·검증 기준에 영향을 주는 불확실성은 질문한다. 기존 패턴으로 판단 가능한 구현 선택은 가정을 명시하고 진행한다.
- 더 간단한 접근이나 중요한 트레이드오프가 있으면 설명한다. 요청을 해결하는 최소한의 코드만 작성하고, 요청되지 않은 기능·추상화·설정은 추가하지 않는다.
- 같은 요구사항을 더 적은 개념과 분기로 명확하게 표현할 수 있으면 단순화한다.
- 기존 스타일을 따르고 필요한 부분만 수정한다. 무관한 코드·주석·포맷·기존 데드 코드는 변경하지 않는다. 자신의 수정으로 불필요해진 요소만 제거한다.
- 다단계 작업은 단계별 성공 기준과 검증 방법을 먼저 정한다. 버그 수정은 재현 검사와 수정 후 통과를, 리팩토링은 기존 동작 보존을 확인한다.

## Windows Shell Policy

- 복잡한 PowerShell은 인라인 문자열·중첩 인용 대신 UTF-8 임시 .ps1 파일로 작성하고 `powershell -ExecutionPolicy Bypass -File <script.ps1>`로 실행한다.
- `rg ... 폴더 -g '*.확장자'`를 사용한다. `폴더/*.확장자`를 경로로 넘기지 않는다.
- `rg` 종료 코드 1은 정상적인 검색 결과 없음으로 보고하며 실제 오류와 구분한다.

## 프로젝트 환경

- 개발 서버는 기존 프론트 `http://localhost:8081`, 백엔드 `http://localhost:3000`을 사용한다. 서버가 없으면 검증 실패로 보고하며 자동 실행하거나 다른 포트로 우회하지 않는다.
- 서버 실행은 사용자에게 안내한다: 프론트 `npm --prefix front run start -- --port 8081`, 백엔드 `npm --prefix back run start:dev`.
- Node.js 24.7.0, npm 11.5.1. 프론트는 Expo·React Native·React·TypeScript, 백엔드는 NestJS·TypeScript·Vitest를 사용한다. 정확한 패키지 버전은 각 package.json과 lockfile을 기준으로 한다.
- 프론트 테스트는 Jest·jest-expo를 사용하며 화면·컴포넌트·훅은 React Native Testing Library로 검사한다. 사용하는 Expo API는 설치된 SDK 버전의 공식 문서에서 확인한다.
- 비밀 값은 각 프로젝트의 환경 파일에서 관리하고 커밋하지 않는다. 개발·운영 파일 선택은 해당 README를 따른다.

## 문서와 DB

- 설치·실행·검증·운영은 [front/README.md](front/README.md)와 [back/README.md](back/README.md)에 모은다. 하위 폴더에 같은 안내나 별도 행동 지침을 만들지 않는다. 기술 계약은 아래 담당 문서에 기록한다.
- 구조·파일 책임을 변경하기 전 [ARCHITECTURE.md](_docs/ARCHITECTURE.md)의 관련 부분을 확인하고 변경 시 함께 갱신한다.
- 프론트 상태 소유권·세션 저장 위치는 [전역 상태](front/README.md#전역-상태)를 기준으로 하며 변경 시 해당 섹션을 갱신한다.
- REST endpoint 변경 시 같은 작업에서 [API 문서](_docs/api/README.md)의 경로·요청·응답·인증·노출 규칙을 맞춘다. 공통 규칙 변경은 [conventions.md](_docs/api/00-overview/conventions.md)에 반영한다.
- 테이블·도메인 정의는 [_docs/AI_DRAMA_data_model/](_docs/AI_DRAMA_data_model/)을 따른다.
- 애플리케이션 DB 작업은 TypeORM QueryBuilder를 기본으로 한다. 표현하기 어려워 raw SQL을 쓸 때는 코드에 이유를 짧게 명시한다.

## 테스트

| 대상 | 위치 |
| --- | --- |
| 프론트 | `front/tests/**/*.test.ts(x)` |
| 백엔드 HTTP API | `back/test/api/**/*.postman_collection.json` |
| 백엔드 내부 규칙·HTTP로 재현하기 어려운 경계 조건 | `back/test/unit/**/*.spec.ts` |
| Harness | `tools/harness/**/*.test.mjs` |

- 프론트 실행: [프론트 검증](front/README.md#검증). 작성 규약: [RNTL 스킬](.agents/skills/react-native-testing/SKILL.md) · [Jest 스킬](.agents/skills/javascript-typescript-jest/SKILL.md).
- 백엔드 API 실행·fixture/lock·실패 판정: [백엔드 검증](back/README.md#검증). 실행 전에 기존 개발 서버의 변경 코드 반영을 확인한다.

## Codex Harness

- `$harness-plan`, `$harness`, `$finish-plan`은 명시적으로 호출할 때만 사용한다. 작업은 dev에서만 하며 branch/worktree를 만들지 않는다.
- 계획 구조·테스트/소스 task 분리·읽기 범위·병렬 및 하위 위임 규칙은 [플랜 규칙](_docs/plans/README.md)과 해당 스킬을 따른다.
- 실행 중에는 task의 files 범위에서 apply_patch로만 수정하며 shell 수정으로 hook을 우회하지 않는다. web-prototype/은 계획·수정·검증에서 제외한다.
- 실행 중 task가 있으면 직접 commit/push·branch 조작을 하지 않는다. 완료 plan의 검증·commit/push는 `$finish-plan`의 `node tools/harness/cli.mjs finish`만 수행한다.
