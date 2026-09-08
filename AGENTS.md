트레이드오프: 본 지침은 속도보다 신중함에 우선순위를 둔다. 사소한 작업은 상황에 맞게 판단한다.

### 1. 구현 전 사고 (Think Before Coding)
가정하지 않는다. 모호함을 숨기지 않는다. 트레이드오프를 명확히 밝힌다.

구현을 시작하기 전 다음을 준수한다:

- 자신의 가정을 명시적으로 기술한다. 불확실한 경우 질문한다.

- 해석의 여지가 여러 가지라면 임의로 선택하지 말고 대안들을 제시한다.

- 더 간단한 접근 방식이 있다면 제안한다. 정당한 사유가 있다면 사용자의 요청에 반대 의견을 제시한다.

- 불분명한 부분이 있다면 작업을 중단한다. 혼란스러운 부분을 구체적으로 언급하며 질문한다.

### 2. 단순성 우선 (Simplicity First)
- 문제를 해결하는 최소한의 코드만 작성한다. 추측에 기반한 코드는 배제한다.

- 요청되지 않은 기능은 추가하지 않는다.

- 일회성 코드를 위해 추상화 계층을 만들지 않는다.

- 요청되지 않은 유연성이나 설정 가능성을 고려하지 않는다.

- 발생 불가능한 시나리오에 대한 예외 처리를 하지 않는다.

- 200줄의 코드를 50줄로 줄일 수 있다면 코드를 다시 작성한다.

- "시니어 엔지니어가 보기에 이 코드가 지나치게 복잡한가?"라고 자문한다. 그렇다면 단순화한다.

### 3. 정밀한 수정 (Surgical Changes)
필요한 부분만 수정한다. 본인이 만든 코드의 뒷정리만 수행한다.

기존 코드를 편집할 때 다음을 준수한다:

- 인접한 코드, 주석, 포맷을 임의로 개선하지 않는다.
- 망가지지 않은 부분을 리팩토링하지 않는다.
- 본인의 스타일과 다르더라도 기존 스타일을 따른다.
- 작업과 무관한 데드 코드를 발견하면 보고하되 직접 삭제하지 않는다.

수정으로 인해 사용되지 않게 된 요소가 발생할 경우:

- 본인의 수정으로 인해 불필요해진 임포트, 변수, 함수는 제거한다.
- 기존에 존재하던 데드 코드는 요청이 없는 한 그대로 둔다.
- 테스트 기준: 변경된 모든 라인은 사용자의 요청사항과 직접적으로 연결되어야 한다.

### 4. 목표 중심 실행 (Goal-Driven Execution)
성공 기준을 정의한다. 검증될 때까지 반복한다.
작업을 검증 가능한 목표로 변환한다:

- "유효성 검사 추가" → "잘못된 입력에 대한 테스트 작성 후 통과 확인"
- "버그 수정" → "버그를 재현하는 테스트 작성 후 통과 확인"
- "X 리팩토링" → "리팩토링 전후의 테스트 통과 확인"

다단계 작업의 경우 간략한 계획을 수립한다:

1. [단계] → 검증: [확인 사항]
2. [단계] → 검증: [확인 사항]
3. [단계] → 검증: [확인 사항]
성공 기준이 명확해야 독립적인 작업이 가능하다. "작동하게 만들기"와 같은 모호한 기준은 불필요한 재질의를 야기한다.

지침 작동 확인: Diff 내 불필요한 변경 감소, 복잡성으로 인한 재작성 빈도 감소, 구현 전 질문을 통한 명확한 의사결정 증대.

## Windows Shell Policy
- DO NOT attempt inline multi-line PowerShell strings or complex nested quotes.
- ALWAYS write complex scripts into a temporary .ps1 file (using UTF-8 encoding) and execute via `powershell -ExecutionPolicy Bypass -File <script.ps1>`.

## 프로젝트 환경

- Node.js: 24.7.0
- npm: 11.5.1
- `front/`: Expo Router가 적용된 Expo 57 기반 React Native 0.86.3, React 19, TypeScript 6
- `back/`: NestJS 12, TypeScript 6, Vitest 4
- 프론트엔드와 백엔드는 각각 독립된 `package.json`과 lockfile을 관리한다.
- 비밀 값은 `.env`에 두며 저장소에 커밋하지 않는다.

## _docs 폴더 구조

- `_docs/ARCHITECTURE.md` -- 시스템 아키텍처와 레이어 구조
- `_docs/plans/` -- plan 정의, task 지시, 실행 상태

## 프로젝트 구조 규칙

- `front/src/app/` — 사용자가 담당하는 Expo Router route와 네비게이터 설정.
- `front/src/screens/`, `front/src/components/`, `front/src/theme/` — 퍼블리셔가 담당하는 화면 UI, 재사용 UI, 디자인 토큰.
- `front/assets/` — 퍼블리셔가 담당하는 앱 아이콘, 이미지, 폰트 등 정적 리소스. 화면 이미지와 아이콘은 각각 `assets/images/`, `assets/icons/`에 둔다.
- `front/src/features/` — 사용자가 담당하는 기능별 상태, endpoint, 타입. 기능별 API는 해당 기능 폴더에 둔다.
- `front/src/services/` — 사용자가 담당하는 공통 HTTP client, 저장소, 환경 설정.
- `front/src/utils/` — 사용자가 담당하는 순수 공용 함수. API 호출이나 업무 상태를 두지 않는다.
- `back/src/` — NestJS 애플리케이션 코드. 기능별 module/controller/service를 이 영역에 둔다.
- `back/src/**/*.spec.ts` — 백엔드 단위 테스트. `back/test/` — e2e 테스트.
- `_docs/ARCHITECTURE.md` — 시스템 구조와 프론트-백엔드 경계 문서.
- `_docs/plans/` — 작업 계획, 태스크 지시, 실행 상태 문서.
- 모든 구조 변경은 `_docs/ARCHITECTURE.md`에 반영한다.

## 협업 규칙

- 퍼블리셔는 `front/src/screens/`, `front/src/components/`, `front/src/theme/`, `front/assets/`만 수정한다. 정적 더미 데이터와 화면 내부 UI 동작은 담당 범위에 포함된다.
- 퍼블리셔 UI 파일에는 API 호출, 인증 토큰, 전역 상태, `features/` 또는 `services/` 의존성을 넣지 않는다.
- 사용자는 `front/src/app/`, `front/src/features/`, `front/src/services/`, `front/src/utils/`, `back/`을 담당한다.
- 두 작업자는 `main`에 직접 푸시한다. CODEOWNERS와 자동 검사는 사용하지 않는다.
