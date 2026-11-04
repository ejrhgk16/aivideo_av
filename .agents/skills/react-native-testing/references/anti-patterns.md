# RNTL Anti-Patterns

Unless marked v14, render/fireEvent examples use v13 APIs. For v14, await render/fireEvent/rerender/unmount/cleanup. BAD/GOOD labels express a preferred testing approach; explicit native boundaries and shared cleanup may justify the documented exceptions.

## Table of Contents

- Wrong query variant
- Not using \*ByRole
- Wrong assertions
- waitFor misuse
- Unnecessary act()
- fireEvent instead of userEvent
- Destructuring render
- Using UNSAFE_root
- Manual cleanup
- Legacy accessibility props
- Forgetting to await (v14)
- Using removed APIs (v14)

## Wrong query variant

```tsx
// BAD: queryBy* when element should exist
const button = screen.queryByRole('button');
expect(button).toBeOnTheScreen();

// GOOD: getBy* when element should exist
const button = screen.getByRole('button');
expect(button).toBeOnTheScreen();

// BAD: getBy* for non-existence check (throws instead of failing gracefully)
expect(screen.getByText('Error')).not.toBeOnTheScreen();

// GOOD: queryBy* for non-existence check
expect(screen.queryByText('Error')).not.toBeOnTheScreen();

// BAD: waitFor + getBy* for async elements
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeOnTheScreen();
});

// GOOD: findBy* for async elements
expect(await screen.findByText('Loaded')).toBeOnTheScreen();
```

## Not using \*ByRole

```tsx
// BAD: testID when accessible query works
<Pressable testID="submit-btn" role="button">
  <Text>Submit</Text>
</Pressable>;
screen.getByTestId('submit-btn');

// GOOD: query by role and accessible name
screen.getByRole('button', { name: 'Submit' });

// BAD: getByText for a button (less semantic)
screen.getByText('Submit');

// GOOD: getByRole with name (more semantic, tests accessibility)
screen.getByRole('button', { name: 'Submit' });
```

## Wrong assertions

```tsx
// BAD: asserting on props directly
expect(button.props['aria-disabled']).toBe(true);
expect(button.props.style.backgroundColor).toBe('red');

// GOOD: use RNTL matchers
expect(button).toBeDisabled();
expect(button).toHaveStyle({ backgroundColor: 'red' });

// BAD: redundant null check (getBy already throws)
const el = screen.getByText('Hello');
expect(el).not.toBeNull();

// GOOD: use toBeOnTheScreen
expect(screen.getByText('Hello')).toBeOnTheScreen();
```

## waitFor misuse

```tsx
// BAD: side-effect inside waitFor (press runs on every retry)
await waitFor(() => {
  fireEvent.press(screen.getByRole('button'));
  expect(screen.getByText('Result')).toBeOnTheScreen();
});

// GOOD: side-effect outside, assertion inside
fireEvent.press(screen.getByRole('button'));
await waitFor(() => {
  expect(screen.getByText('Result')).toBeOnTheScreen();
});

// BETTER: use findBy*
fireEvent.press(screen.getByRole('button'));
expect(await screen.findByText('Result')).toBeOnTheScreen();

// BAD: empty waitFor callback
await waitFor(() => {});

// BAD: multiple assertions in single waitFor
await waitFor(() => {
  expect(screen.getByText('Title')).toBeOnTheScreen();
  expect(screen.getByText('Subtitle')).toBeOnTheScreen();
});

// GOOD: one assertion per waitFor, rest after
await waitFor(() => {
  expect(screen.getByText('Title')).toBeOnTheScreen();
});
expect(screen.getByText('Subtitle')).toBeOnTheScreen();
```

## Unnecessary act()

These examples concern helpers that already manage React updates. External Promise completions, DOM/player events, and manual timer advancement may still require awaited `act`.

```tsx
// BAD: wrapping render in act
act(() => {
  render(<Component />);
});

// GOOD: render handles act internally
render(<Component />);

// BAD: wrapping fireEvent in act
act(() => {
  fireEvent.press(button);
});

// GOOD: fireEvent handles act internally
fireEvent.press(button);

// BAD: wrapping userEvent in act
await act(async () => {
  await user.press(button);
});

// GOOD: userEvent handles act internally
await user.press(button);
```

## fireEvent instead of userEvent

```tsx
// BAD: fireEvent.press (only fires onPress, no pressIn/pressOut)
fireEvent.press(button);

// GOOD: userEvent.press (full press lifecycle)
const user = userEvent.setup();
await user.press(button);

// BAD: fireEvent.changeText (sets text all at once, no focus/blur/keyPress)
fireEvent.changeText(input, 'Hello');

// GOOD: user.type (char-by-char with full event sequence)
await user.type(input, 'Hello');
```

## Destructuring render

```tsx
// BAD: destructuring queries from render
const { getByText, getByRole } = render(<Component />);
getByText('Hello');

// GOOD: use screen object
render(<Component />);
screen.getByText('Hello');
```

## Using UNSAFE_root

```tsx
// BAD: traversing the tree manually
const { UNSAFE_root } = render(<Component />);
const el = UNSAFE_root.findAll((node) => node.props.testID === 'foo')[0];

// GOOD: use proper queries
render(<Component />);
screen.getByTestId('foo');
```

## Manual cleanup

Avoid duplicate per-test cleanup when auto-cleanup is active. Explicit cleanup remains valid when auto-cleanup is disabled or shared setup needs a specific cleanup order.

```tsx
// BAD: adding redundant per-test cleanup when auto-cleanup already covers it
afterEach(() => {
  cleanup();
});

// GOOD: just don't - RNTL auto-cleans after each test
```

## Legacy accessibility props

Both ARIA and React Native accessibility props are supported. The examples below show equivalent forms, not deprecated or invalid APIs. Follow existing product conventions rather than changing production props for tests.

```tsx
// Supported: React Native accessibility props
<Pressable accessibilityRole="button" accessibilityLabel="Submit">
  <Text>Submit</Text>
</Pressable>;

// Equivalent: ARIA-compatible props
<Pressable role="button" aria-label="Submit">
  <Text>Submit</Text>
</Pressable>;

// Supported: native accessibility state
<Pressable accessibilityState={{ disabled: true, checked: true }} />;

// Equivalent: ARIA state props
<Pressable aria-disabled aria-checked />;
```

## Forgetting to await (v14)

In RNTL v14, `render`, `fireEvent`, `rerender`, `unmount`, `renderHook`, and `act` are async. Forgetting `await` causes subtle bugs where tests pass but assertions run before operations complete.

```tsx
// BAD: missing await on render (v14)
render(<Component />);
expect(screen.getByText('Hello')).toBeOnTheScreen(); // may fail intermittently

// GOOD: await render (v14)
await render(<Component />);
expect(screen.getByText('Hello')).toBeOnTheScreen();

// BAD: missing await on fireEvent (v14)
fireEvent.press(screen.getByRole('button'));
// state updates may not have flushed yet

// GOOD: await fireEvent (v14)
await fireEvent.press(screen.getByRole('button'));

// BAD: missing await on act (v14)
act(() => {
  result.current.increment();
});

// GOOD: await act (v14)
await act(() => {
  result.current.increment();
});
```

## Using removed APIs (v14)

These APIs exist in v13 but are removed in v14. Using them will cause import or runtime errors.

```tsx
// BAD: using renderAsync in v14 (removed — render is already async)
import { renderAsync } from '@testing-library/react-native';
await renderAsync(<Component />);

// GOOD: use render in v14
import { render } from '@testing-library/react-native';
await render(<Component />);

// BAD: using fireEventAsync in v14 (removed — fireEvent is already async)
import { fireEventAsync } from '@testing-library/react-native';
await fireEventAsync.press(button);

// GOOD: use fireEvent in v14
import { fireEvent } from '@testing-library/react-native';
await fireEvent.press(button);

// BAD: using UNSAFE_root in v14 (removed)
screen.UNSAFE_root;

// GOOD: use container or root in v14
screen.container;
screen.root;

// BAD: using concurrentRoot option in v14 (removed — always on)
render(<Component />, { concurrentRoot: false });

// GOOD: just render without concurrentRoot
await render(<Component />);

// BAD: using update() in v14 (removed)
screen.update(<Component newProp />);

// GOOD: use rerender in v14
await screen.rerender(<Component newProp />);
```

## 프로젝트 실패 진단

API 목록은 해당 버전 참고자료, Expo 환경 문제는 [Expo 규약](expo.md)을 확인한다.

| 증상 | 확인할 내용 |
| --- | --- |
| query가 여러 요소와 일치 | 실제 중복인지 확인하고 카드·필터 등 의미 있는 범위로 한정한다. 첫 요소를 임의 선택하지 않는다. |
| 요소가 없음 | 로딩·오류·hidden·영상 준비 조건과 현재 경로를 확인한다. 부재가 올바른 동작일 수도 있다. |
| act 경고·unmounted renderer | 최초 실패와 미완료 Promise/타이머를 확인한다. 뒤 테스트의 연쇄 오류를 개별 제품 버그로 단정하지 않는다. |
| 단독 실행은 통과, 전체는 실패 | 미소비 mockOnce·singleton·환경·구독·전역 descriptor가 남았는지 확인한다. |
| 모듈/타입/API 오류 | 설치된 export·matcher·버전별 동기/비동기 API를 확인한다. 기억한 다른 버전의 API를 넣지 않는다. |
| timeout | 마지막으로 완료된 단계를 확인한다. test 선언 stack이나 함수의 첫 await만으로 정지 위치를 추정하지 않는다. |
| 기대값만 계속 어긋남 | stale/fresh 응답, 자동 재조회, 현재 선택 유지 등 실제 계약과 fixture 순서를 다시 대조한다. |
| native 호출 기록을 못 찾음 | host ref와 preset class instance를 구분한다. jest.mocked는 실제 메서드를 mock으로 바꾸지 않는다. |

필요하면 실패 케이스만 좁혀 진단한다. 임시 로그는 제거하고 원래 선택 검사와 필요한 전체 검증을 다시 수행한다. 새로운 mock·임의 sleep·timeout 증가를 진단의 대체물로 추가하지 않는다.
