---
name: javascript-typescript-jest
description: Write, review, or fix JavaScript/TypeScript Jest tests for API contracts and pure logic, including dependency mocks, asynchronous races, isolation, and focused execution.
---

### Test Structure
- Follow repository filename conventions. This frontend discovers `.test.ts` and `.test.tsx`; general Jest repositories may also allow `.test.js`/`.test.jsx`.
- Follow repository-defined test locations. Colocation or a dedicated `__tests__` directory is an option only where the repository permits it.
- Use descriptive test names that explain the expected behavior
- Use nested describe blocks where they help organize related tests; follow existing repository structure.
- Example structure: `describe('Component/Function/Class', () => { it('should do something', () => {}) })`; this is not a mandatory wrapper.

### Effective Mocking
- Mock external dependencies (APIs, databases, etc.) to isolate your tests
- Use `jest.mock()` for module-level mocks
- Use `jest.spyOn()` for specific function mocks. It calls the original implementation by default; set a mock implementation/return value before invoking an external side effect.
- Use `mockImplementation()` or `mockReturnValue()` to define mock behavior
- Isolate mocks between tests: choose clear, reset, or restore for the mock lifecycle. Use `jest.resetAllMocks()` only when resetting every mock implementation is intended.

### Testing Async Code
- Always return promises or use async/await syntax in tests; return or await `resolves`/`rejects` assertions too.
- Use `resolves`/`rejects` matchers for promises
- Set justified timeouts for genuinely slow tests with `jest.setTimeout()` after ruling out incorrect waits, timers, or module errors.

### Snapshot Testing
- Use focused snapshot tests for stable UI or complex objects where useful; keep behavioral assertions rather than replacing them with snapshots.
- Keep snapshots small and focused
- Review snapshot changes carefully before committing

### Testing React Components
- Use React Native Testing Library for React Native components; React Testing Library applies to web React components. Prefer Testing Library over Enzyme.
- Test user behavior and component accessibility
- Query elements by accessibility roles, labels, or text content
- Use `userEvent` over `fireEvent` for more realistic user interactions

## Common Jest Matchers

Mock lifecycle semantics follow the [Jest 29.7 mock-function API](https://jestjs.io/docs/29.7/mock-function-api) used by this repository.

- Basic: `expect(value).toBe(expected)`, `expect(value).toEqual(expected)`
- Truthiness: `expect(value).toBeTruthy()`, `expect(value).toBeFalsy()`
- Numbers: `expect(value).toBeGreaterThan(3)`, `expect(value).toBeLessThanOrEqual(3)`
- Strings: `expect(value).toMatch(/pattern/)`, `expect(value).toContain('substring')`
- Arrays: `expect(array).toContain(item)`, `expect(array).toHaveLength(3)`
- Objects: `expect(object).toHaveProperty('key', value)`
- Exceptions: `expect(fn).toThrow()`, `expect(fn).toThrow(Error)`
- Mock functions: `expect(mockFn).toHaveBeenCalled()`, `expect(mockFn).toHaveBeenCalledWith(arg1, arg2)`

## 프로젝트 추가 규약


컴포넌트 렌더링은 [RNTL 스킬](../react-native-testing/SKILL.md)을 따른다. 이 스킬의 Jest API를 Vitest·Postman 테스트에 그대로 적용하지 않는다.

### 계약과 격리

- 테스트 위치·실행기는 저장소 규칙과 package.json을 따른다. src 옆 테스트, __tests__, describe 구조를 임의로 강제하지 않는다.
- 제품 함수를 직접 import하고 외부 경계만 mock한다. HTTP는 메서드·URL·헤더·본문·응답·오류를 검증하고, UI snapshot으로 동작 검증을 대체하지 않는다.
- fixture는 실제 공개 타입으로 작성한다. 예상 요청 수·재조회·상태 유지 여부는 구현의 공개 계약과 대조한다.
- mock은 필요에 맞게 정리한다: `mockClear`는 호출 기록, `mockReset`은 구현과 once 큐, `mockRestore`는 spy의 원래 구현을 복구한다. 전역 resetAllMocks를 무조건 적용하지 않는다.
- `restoreAllMocks()`는 spy와 `replaceProperty`를 복구하지만 직접 대입한 `jest.fn()`·fetch·환경변수는 복구하지 않는다. 원래 값을 따로 보관하고 되돌린다.
- 미소비 once 응답·session singleton·fetch·환경변수가 다음 테스트로 새지 않게 한다. 모듈 격리는 실제 singleton 초기화가 필요한 경우에만 사용한다.
- `jest.mocked`는 타입 도우미다. 실제 함수가 mock인지 확인하고 호출 기록에 접근한다.

### 비동기와 시간

- Promise·resolves/rejects·비동기 helper를 모두 await한다. 경합은 deferred 응답의 시작·완료 순서를 명시한다.
- 요청 수나 revision의 기준값은 동작을 시작하기 전에 잡는다. 저장 중 시작한 오래된 조회와 저장 완료 후 시작한 새 조회를 구분한다.
- 타입/모듈 오류·대기 조건·타이머를 확인한 뒤 timeout을 판단한다. 타이머를 전부 소진하거나 전역 제한을 늘려 원인 미확인을 숨기지 않는다.
- 늦은 응답·취소·재시도·정리 실패도 독립적으로 검증한다. 기존 경계값·오류 조건·하위 시나리오를 보존한다.

### 실행

- 이 저장소의 프론트는 `npm --prefix front run test -- tests/unit/<실제 파일명>`으로 정확한 파일을 선택한다. 무인자 실행은 전체 발견이며 실행기에 임의 Jest 옵션을 넘기지 않는다.
- 관련 파일과 영향받는 소비 기능부터 검사한다. Harness 작업에서는 승인된 역할별 checks와 최종 검증 절차를 따른다.
- 실패는 최초 오류와 단독/전체 실행 차이부터 확인한다. timeout 선언 위치를 실제 멈춘 await 위치로 단정하지 않는다.
- 실행하지 않은 검사는 통과로 보고하지 않는다. 결과에는 명령·종료 상태·실제 suite/test/skip 수를 기록한다.
