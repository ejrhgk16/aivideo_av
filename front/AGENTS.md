# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Tests

- 프론트 제품 테스트는 `front/tests/**/*.test.ts(x)`에만 둔다. `src/`에 새 테스트를 만들지 않는다.
- `npm run test`는 `tests/unit/experience.test.ts`를 TypeScript로 컴파일한 뒤 Node test runner로 실행한다.
- 프론트 변경은 `npm run typecheck`, `npm run test`, `npm run export`로 검증한다.
