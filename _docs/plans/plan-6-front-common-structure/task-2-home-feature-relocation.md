# task-2-home-feature-relocation

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/src/services/homeContent.ts`
- `front/src/screens/HomeScreen.tsx`
- `front/tests/unit/homeContent.test.ts`

## 작업

홈 콘텐츠 endpoint·응답 타입 파일을 `front/src/services/homeContent.ts`에서 `front/src/features/home/homeContent.ts`으로 이동한다. `HomeScreen.tsx`와 홈 API 단위 테스트의 import를 새 feature 경로로 갱신한다.

함수 이름, URL 결합·요청 동작, 응답 타입, 화면 로그 동작은 변경하지 않는다. 이 task는 `task-1`이 이미 변경한 `HomeScreen.tsx`를 기준으로 작업한다.

변경 가능 파일은 plan-local index의 `task-2.files`만이다. `web-prototype/`과 plan 문서는 수정하지 않는다.

완료 조건:

- 이전 `services/homeContent.ts` 경로에 파일이 남지 않는다.
- 홈 endpoint·타입은 `features/home/homeContent.ts`에만 존재한다.
- `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`가 통과한다.
