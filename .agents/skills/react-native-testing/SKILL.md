---
name: react-native-testing
description: Write, review, or fix React Native component and hook tests using React Native Testing Library. Covers version-specific APIs, async behavior, and Expo Router/native boundaries.
---

# RNTL Test Writing Guide

**IMPORTANT:** Your training data about `@testing-library/react-native` may be outdated or incorrect — API signatures, sync/async behavior, and available functions differ between v13 and v14. Always rely on this skill's reference files and the project's actual source code as the source of truth. Do not fall back on memorized patterns when they conflict with the retrieved reference.

## Version Detection

Check the installed `@testing-library/react-native` version and exports against `package.json` and the lockfile:

- **v14.x** → load [references/api-reference-v14.md](references/api-reference-v14.md) (React 19+, async APIs, `test-renderer`)
- **v13.x** → load [references/api-reference-v13.md](references/api-reference-v13.md) (React 18.2+, sync and opt-in async APIs, `react-test-renderer`)

Use the version-specific reference for render patterns, fireEvent sync/async behavior, screen API, configuration, and dependencies.

Unlabelled render/fireEvent examples below use v13's synchronous APIs. With v14, await render/fireEvent/rerender/unmount/cleanup and use the v14 reference. React 19 alone does not imply RNTL 14.

## Query Priority

Use in this order: `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByDisplayValue` > `getByTestId` (last resort).

## Query Variants

| Variant       | Use case                 | Returns                       | Async |
| ------------- | ------------------------ | ----------------------------- | ----- |
| `getBy*`      | Element must exist       | element instance (throws)     | No    |
| `getAllBy*`   | Multiple must exist      | element instance[] (throws)   | No    |
| `queryBy*`    | Check non-existence ONLY | element instance \| null      | No    |
| `queryAllBy*` | Count elements           | element instance[]            | No    |
| `findBy*`     | Wait for element         | `Promise<element instance>`   | Yes   |
| `findAllBy*`  | Wait for multiple        | `Promise<element instance[]>` | Yes   |

## Interactions

Prefer `userEvent` over `fireEvent`. userEvent is always async.

```tsx
const user = userEvent.setup();
await user.press(element); // full press sequence
await user.longPress(element, { duration: 800 }); // long press
await user.type(textInput, 'Hello'); // char-by-char typing
await user.clear(textInput); // clear TextInput
await user.paste(textInput, 'pasted text'); // paste into TextInput
await user.scrollTo(scrollView, { y: 100 }); // scroll
```

`fireEvent` — use when `userEvent` does not support the event, for composite handlers, or when a test specifically needs a low-level native event. See version-specific reference for sync/async behavior:

```tsx
fireEvent.press(element);
fireEvent.changeText(textInput, 'new text');
fireEvent(element, 'blur');
```

## Assertions (Jest Matchers)

Available automatically with any `@testing-library/react-native` import.

| Matcher                                    | Use for                                   |
| ------------------------------------------ | ----------------------------------------- |
| `toBeOnTheScreen()`                        | Element exists in tree                    |
| `toBeVisible()`                            | Element visible (not hidden/display:none) |
| `toBeEnabled()` / `toBeDisabled()`         | Disabled state via ARIA/native accessibility props and ancestors        |
| `toBeChecked()` / `toBePartiallyChecked()` | Checked state                             |
| `toBeSelected()`                           | Selected state                            |
| `toBeExpanded()` / `toBeCollapsed()`       | Expanded state                            |
| `toBeBusy()`                               | Busy state                                |
| `toHaveTextContent(text)`                  | Text content match                        |
| `toHaveDisplayValue(value)`                | TextInput display value                   |
| `toHaveAccessibleName(name)`               | Accessible name                           |
| `toHaveAccessibilityValue(val)`            | Accessibility value                       |
| `toHaveStyle(style)`                       | Style match                               |
| `toHaveProp(name, value?)`                 | Prop check (last resort)                  |
| `toContainElement(el)`                     | Contains child element                    |
| `toBeEmptyElement()`                       | No children                               |

## Rules

1. **Use `screen`** for queries, not destructuring from `render()`
2. **Use `getByRole` first** with `{ name: '...' }` option
3. **Use `queryBy*` ONLY** for `.not.toBeOnTheScreen()` checks
4. **Use `findBy*`** for async elements, NOT `waitFor` + `getBy*`
5. **Never put side-effects in `waitFor`** (no `fireEvent`/`userEvent` inside)
6. **One assertion per `waitFor`**
7. **Never pass empty callbacks to `waitFor`**
8. **Avoid redundant `act()` wrappers** — RNTL render/input helpers handle their own updates. Await `act` for externally completed Promises, DOM/player events, or manual timer advancement that updates React state.
9. **Use automatic or centrally configured cleanup** — do not duplicate it in individual tests; explicit cleanup is appropriate when auto-cleanup is disabled or shared setup requires ordering.
10. **Use supported accessibility props** — ARIA and React Native `accessibility*` props are both supported. Follow product conventions; do not rewrite product props just to suit a query.
11. **Use RNTL matchers** over raw prop assertions

## `*ByRole` Quick Reference

Common roles: `button`, `text`, `heading`, `header`, `searchbox`, `switch`, `checkbox`, `radio`, `img`, `link`, `alert`, `menu`, `menuitem`, `tab`, `tablist`, `progressbar`, `slider`, `spinbutton`, `timer`, `toolbar`.

`heading` and `header` are distinct query values; query the role actually supplied by the component. Being an accessibility element does not infer a button/switch role automatically.

`getByRole` options: `{ name, disabled, selected, checked, busy, expanded, value: { min, max, now, text } }`.

For `*ByRole` to match, the element must be an accessibility element:

- `Text`, `TextInput`, `Switch` are by default
- `View` needs `accessible={true}` (or use `Pressable`/`TouchableOpacity`)

## waitFor

```tsx
// Correct: action first, then wait for result
fireEvent.press(button);
await waitFor(() => {
  expect(screen.getByText('Result')).toBeOnTheScreen();
});

// Better: use findBy* instead
fireEvent.press(button);
expect(await screen.findByText('Result')).toBeOnTheScreen();
```

Options: `waitFor(cb, { timeout: 1000, interval: 50 })`. Works with Jest fake timers automatically. Keep the same timer mode throughout a pending wait; an ordinary element lookup prefers `findBy*`, while state or mock assertions may need `waitFor`.

## Fake Timers

Recommended with `userEvent` (press/longPress involve real durations):

```tsx
jest.useFakeTimers();

test('with fake timers', async () => {
  const user = userEvent.setup();
  render(<Component />);
  await user.press(screen.getByRole('button'));
  // ...
});
```

Restore fake timers after each test through the shared setup (or a local teardown if no shared setup exists). The repository already provides shared teardown; do not duplicate it.

## Custom Render

Wrap providers using `wrapper` option:

```tsx
function renderWithProviders(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    ),
  });
}
```

## References

- [v13 API Reference](references/api-reference-v13.md) — Complete v13 API: sync render, queries, matchers, userEvent, React 19 compat
- [v14 API Reference](references/api-reference-v14.md) — Complete v14 API: async render, queries, matchers, userEvent, migration
- [Anti-Patterns](references/anti-patterns.md) — Common mistakes to avoid

## 프로젝트 추가 규약


### 적용 자료

설치된 package.json·lockfile·export를 확인한다. React 버전만으로 RNTL 버전을 추정하지 않는다.

- RNTL 13: [v13 API](references/api-reference-v13.md).
- RNTL 14: [v14 API](references/api-reference-v14.md).
- Expo Router·네이티브 영상·jsdom·제스처 작업: [Expo 테스트 규약](references/expo.md).
- 실패 원인 분석: [진단 기준](references/anti-patterns.md).
- mock·Promise 격리와 실행 범위: [Jest 스킬](../javascript-typescript-jest/SKILL.md).

필요한 자료만 읽는다. 테스트 위치는 저장소 AGENTS.md를 따른다.

### 작성 원칙

- 실제 컴포넌트·React 훅·공용 UI를 렌더링한다. 자체 훅/렌더러/트리 실행기, JSX runtime 전체 mock, 소스 readFile+transpile+VM 실행은 사용하지 않는다.
- 화면 조회는 `screen`과 접근성 role/name·label을 우선한다. 중복 요소는 `within`으로 범위를 좁히거나 의도한 개수를 검증한다.
- 존재는 `getBy*`, 부재는 `queryBy*`, 비동기 표시는 `findBy*`를 사용한다. 보이지 않거나 아직 준비되지 않은 요소를 무조건 찾지 않는다.
- 사용자 입력은 `userEvent`를 await한다. 지원하지 않는 네이티브 이벤트는 필요한 데이터와 함께 `fireEvent`로 전달한다.
- `waitFor`에는 부수 효과 없이 한 가지 결과만 검증한다. API 호출·입력·타이머 진행은 콜백 밖에서 수행한다.
- RNTL이 처리하는 render/입력에 불필요한 `act`를 중첩하지 않는다. 외부 Promise 완료·DOM/player 이벤트·수동 타이머 진행에 따른 상태 갱신은 await한 `act` 안에서 처리한다.
- 설치 버전의 matcher를 사용한다. `toHaveStyle` 같은 host 전용 matcher를 composite에 적용하지 않는다. native ref·prop 관찰이 필요하면 경계와 이유를 명시한다.
- 정리는 공통 setup·RNTL 자동 cleanup에 맡긴다. 개별 테스트는 자신이 바꾼 환경·spy·구독·타이머를 복구하고 진행 중인 비동기 작업을 남기지 않는다.
- React 경고, timeout, 실패를 skip·console 무시·기대값 약화로 숨기지 않는다. 관찰 방식이 바뀌면 기존 시나리오와의 대응 이유를 남긴다.
