# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## API 오류 처리

API 오류 처리·안내 문구·세션 갱신을 수정하기 전에 [프론트 API 오류 처리](../_docs/api/00-overview/error-code.md)를 읽는다. 코드별 규칙은 그 문서에서 관리한다.

## Tests

- 프론트 제품 테스트는 `front/tests/**/*.test.ts(x)`에만 둔다. `src/`에 새 테스트를 만들지 않는다.
- `npm run test`는 인자 없이 실행하면 `tests/` 아래 모든 `.test.ts`와 `.test.tsx`를 발견해 정렬한 뒤 실행한다. 특정 파일만 검증하려면 `npm run test -- tests/unit/<feature>.test.ts`처럼 정확한 파일 경로를 전달한다.
- 각 task의 checks는 변경 기능과 영향받는 기능의 테스트 파일을 선택한다. 테스트 실행기 자체 변경은 선택 실행과 전체 발견 실행을 모두 검증한다. 전체 프론트 검증인 `npm run typecheck`, `npm run test`, `npm run export`는 최종 `$finish-plan`에서 수행한다.
