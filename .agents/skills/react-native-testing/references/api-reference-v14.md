# RNTL v14 API Reference

API reference for `@testing-library/react-native` v14.x (React 19+), cross-checked with the [official migration guide](https://github.com/callstack/react-native-testing-library/blob/main/website/docs/14.x/docs/start/migration-v14.mdx) and current upstream source. This repository uses v13.3.3; do not apply v14 APIs to its tests.

**Test renderer:** `test-renderer` (not `react-test-renderer`)
**Element type:** `TestInstance` (not `ReactTestInstance`)

The declarations below summarize public API shapes; executable examples assume app components/providers are imported. Verify exports against the installed patch version.

## Table of Contents

- Core Pattern
- Key Rule: Always await
- render
- screen
- Queries
- User Event
- Fire Event
- Jest Matchers
- Async Utilities
- Other Helpers
- renderHook
- act
- Configuration
- Accessibility
- Removed APIs
- Migration Codemods

---

## Core Pattern

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';

jest.useFakeTimers(); // recommended when using userEvent

test('description', async () => {
  const user = userEvent.setup();
  await render(<Component />); // async in v14 — always await

  const button = screen.getByRole('button', { name: 'Submit' });
  await user.press(button);

  expect(screen.getByText('Done')).toBeOnTheScreen();
});
```

---

## Key Rule: Always `await`

In v14, the following APIs are **async** and must always be awaited:

- `await render(<Component />)`
- `await fireEvent.press(element)` (and all fireEvent variants)
- `await screen.rerender(<Component />)`
- `await screen.unmount()`
- `await renderHook(() => useHook())`
- `await act(() => { ... })` (even with sync callbacks)
- `await cleanup()` when explicitly called

---

## render

```ts
declare function render(
  component: React.ReactElement<any>,
  options?: RenderOptions,
): Promise<RenderResult>;
```

`render` returns a `Promise<RenderResult>` — always `await` it.

There is no `renderAsync` in v14. The standard `render` is already async.

### Options

| Option           | Type                       | Description                                           |
| ---------------- | -------------------------- | ----------------------------------------------------- |
| `wrapper`        | `React.ComponentType<any>` | Wraps tested component (useful for context providers) |
| `createNodeMock` | Removed in v14            | Mock the native/component boundary instead            |

Note: `createNodeMock`, `concurrentRoot`, and `unstable_validateStringsRenderedWithinText` are removed in v14 (concurrent rendering is always on, string validation is always on).

### Example

```tsx
import { render, screen } from '@testing-library/react-native';

await render(<MyApp />);
expect(screen.getByRole('button', { name: 'start' })).toBeOnTheScreen();

// With wrapper
await render(<MyComponent />, {
  wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
});
```

---

## screen

```ts
type Screen = Queries & {
  rerender(element: React.ReactElement<unknown>): Promise<void>;  // async
  unmount(): Promise<void>;                                    // async
  debug(options?: { message?: string; mapProps?: MapPropsFunction }): void;
  toJSON(): JsonElement | null; // JsonElement from test-renderer
  container: TestInstance;  // pseudo-container containing rendered host roots
  root: TestInstance | null; // first rendered host child, nullable when empty
};
```

The `screen` object provides queries and utilities for the currently rendered UI. Assigned after `render()`, cleared after each test via auto-cleanup.

### Methods

- **`rerender(element)`** — Re-render with new root element. **Async** — must `await`. Triggers lifecycle events.
- **`unmount()`** — Unmount the tree. **Async** — must `await`. Usually not needed (auto-cleanup).
- **`debug({ message?, mapProps? })`** — Pretty-print the rendered tree. Use `mapProps` to filter/transform props in output.
- **`toJSON()`** — Get JSON representation (for snapshot testing).
- **`container`** — Pseudo-container whose children are rendered host roots; it is not the first host element.
- **`root`** — First rendered host child (or `null` when empty); for multiple roots use `container.children`.

Note: `UNSAFE_root` is removed in v14. Use `container` or `root` instead.

---

## Queries

Each query = **variant** + **predicate** (e.g., `getByRole` = `getBy` + `ByRole`).

### Query Variants

| Variant       | Assertion          | Return Type                           | Async |
| ------------- | ------------------ | ------------------------------------- | ----- |
| `getBy*`      | Exactly one match  | `TestInstance` (throws if 0 or >1)    | No    |
| `getAllBy*`   | At least one match | `TestInstance[]` (throws if 0)        | No    |
| `queryBy*`    | Zero or one match  | `TestInstance \| null` (throws if >1) | No    |
| `queryAllBy*` | No assertion       | `TestInstance[]` (empty if 0)         | No    |
| `findBy*`     | Exactly one match  | `Promise<TestInstance>`               | Yes   |
| `findAllBy*`  | At least one match | `Promise<TestInstance[]>`             | Yes   |

`findBy*` / `findAllBy*` accept optional `waitForOptions: { timeout?, interval?, onTimeout? }`.

### Query Predicates

#### `*ByRole` (preferred)

```ts
declare function getByRole(role: TextMatch, options?: {
  name?: TextMatch;
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  busy?: boolean;
  expanded?: boolean;
  value?: { min?: number; max?: number; now?: number; text?: TextMatch };
  includeHiddenElements?: boolean;
}): TestInstance;
```

Matches elements by `role` or `accessibilityRole`. Element must be an accessibility element:

- `Text`, `TextInput`, `Switch` are by default
- `View` needs `accessible={true}` (or use `Pressable`/`TouchableOpacity`)
- Explicit `accessible={false}` overrides default accessibility-element status; a host Image with `alt` is also accessible

`heading` and `header` are not normalized to each other. Query the actual supplied role; accessibility-element status alone does not infer one.

Common roles: `button`, `text`, `heading`, `header`, `searchbox`, `switch`, `checkbox`, `radio`, `img`, `link`, `alert`, `menu`, `menuitem`, `tab`, `tablist`, `progressbar`, `slider`, `spinbutton`, `timer`, `toolbar`.

```tsx
screen.getByRole('button', { name: 'Submit' });
screen.getByRole('button', { name: 'Submit', disabled: true });
screen.getByRole('checkbox', { checked: true });
screen.getByRole('slider', { value: { now: 50, min: 0, max: 100 } });
```

#### `*ByLabelText`

```ts
declare function getByLabelText(text: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): TestInstance;
```

Matches by `aria-label`/`accessibilityLabel` or text content of element referenced by `aria-labelledby`/`accessibilityLabelledBy`.
When multiple elements are referenced, their text content is joined with spaces in the referenced order and matched as a single label.

#### `*ByPlaceholderText`

```ts
declare function getByPlaceholderText(text: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): TestInstance;
```

Matches `TextInput` by `placeholder` prop.

#### `*ByText`

```ts
declare function getByText(text: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): TestInstance;
```

Matches by text content. Joins `<Text>` siblings to find matches (like RN runtime).

#### `*ByDisplayValue`

```ts
declare function getByDisplayValue(value: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): TestInstance;
```

Matches `TextInput` by current display value.

#### `*ByHintText`

```ts
declare function getByHintText(hint: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): TestInstance;
```

Matches by `accessibilityHint` prop. Also available as `getByA11yHint` / `getByAccessibilityHint`.

#### `*ByTestId` (last resort)

```ts
declare function getByTestId(testId: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): TestInstance;
```

Matches by `testID` prop. Use only when other queries don't work.

### TextMatch

```ts
type TextMatch = string | RegExp;
```

- **String**: exact full match by default. Use `{ exact: false }` for case-insensitive substring match.
- **RegExp**: substring match by default. Use anchors (`^...$`) for full match.

```tsx
screen.getByText('Hello World'); // exact full match
screen.getByText('llo Worl', { exact: false }); // substring, case-insensitive
screen.getByText(/World/); // regex substring
screen.getByText(/^hello world$/i); // regex full match, case-insensitive
```

### Common Query Options

- **`includeHiddenElements`** (alias: `hidden`): Include elements hidden from accessibility. Default: `false`.
- **`exact`**: Default `true`. When `false`, matches substrings case-insensitively. No effect on RegExp.
- **`normalizer`**: Custom text normalization function. Default trims whitespace and collapses multiple spaces. Use `getDefaultNormalizer({ trim?, collapseWhitespace? })` to customize.

---

## User Event

Prefer `userEvent` over `fireEvent`. User Event simulates realistic interaction sequences on **host elements only**, with proper event data.

### Setup

```ts
type SetupOptions = {
  delay?: number;
  advanceTimers?: (delay: number) => Promise<void> | void;
};
const options: SetupOptions = {};
const user = userEvent.setup(options);
```

### `press(element)`

```ts
await user.press(element); // returns Promise<void>
```

Full press lifecycle: `pressIn` → `pressOut` → `press`. React Native Pressability introduces a minimum 130ms duration; use fake timers to avoid real delays.

### `longPress(element, options?)`

```ts
await user.longPress(element, { duration: 800 }); // returns Promise<void>
```

Long press (default 500ms). Emits `pressIn`, `longPress`, `pressOut`.

### `type(element, text, options?)`

```ts
await user.type(textInput, 'Hello', {
  skipPress: true,       // optional: skip pressIn/pressOut
  skipBlur: true,        // optional: skip endEditing/blur
  submitEditing: true,  // optional: trigger submitEditing
}); // returns Promise<void>
```

Character-by-character typing on `TextInput`. Appends to existing text (use `clear()` first to replace).

Event sequence per character: `keyPress` → `change` → `changeText` → `selectionChange` (+ `contentSizeChange` for multiline).

### `clear(element)`

```ts
await user.clear(textInput); // returns Promise<void>
```

Clears `TextInput` content. Events: `focus` → `selectionChange` → `keyPress` → `change` → `changeText` → `selectionChange` → `endEditing` → `blur`.

### `paste(element, text)`

```ts
await user.paste(textInput, 'Replacement text'); // returns Promise<void>
```

Selects all existing content and replaces it with the pasted text. Events: `focus` → `selectionChange` → `change` → `changeText` → `selectionChange` → `endEditing` → `blur`.

### `scrollTo(element, options)`

```ts
// Choose the axis that matches the ScrollView's horizontal prop.
await user.scrollTo(verticalScrollView, {
  y: 300,
  momentumY: 500, // optional
  contentSize: { width: 300, height: 1000 }, // optional
  layoutMeasurement: { width: 300, height: 600 }, // optional
});
await user.scrollTo(horizontalScrollView, { x: 300, momentumX: 500 });
```

Scrolls a host `ScrollView`. For `FlatList`, target its rendered host ScrollView rather than the composite FlatList instance. Match scroll direction to `horizontal` prop. Pass `contentSize` and `layoutMeasurement` for `FlatList` updates. Remembers last scroll position between calls.

---

## Fire Event

Use when `userEvent` doesn't support the event or when triggering events on composite elements.

**Async** in v14 — always `await`:

```ts
declare function fireEvent(
  instance: TestInstance,
  eventName: string,
  ...data: unknown[]
): Promise<void>;
```

Traverses tree bottom-up looking for `onXxx` handler. Does **not** auto-pass event data.

### Convenience Methods

```ts
await fireEvent.press(element, eventData);
await fireEvent.changeText(textInput, 'New text');
await fireEvent.scroll(scrollView, scrollEvent);
```

There is no `fireEventAsync` in v14. The standard `fireEvent` is already async.

---

## Jest Matchers

Registered automatically by the standard `@testing-library/react-native` entry point in a Jest-compatible environment. Built-in matchers operate on host elements and support both ARIA and React Native accessibility props; `.pure`/custom entry points should be checked separately.

### Element Existence

| Matcher             | Description                             |
| ------------------- | --------------------------------------- |
| `toBeOnTheScreen()` | Element is attached to the element tree |

### Element Content

| Matcher               | Signature                                                     | Description                 |
| --------------------- | ------------------------------------------------------------- | --------------------------- |
| `toHaveTextContent()` | `(text: string \| RegExp, options?: { exact?, normalizer? })` | Text content match          |
| `toContainElement()`  | `(instance: TestInstance \| null)`                            | Contains child element      |
| `toBeEmptyElement()`  | —                                                             | No children or text content |

### Element State

| Matcher                                                 | Description                                           |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `toHaveDisplayValue(value: string \| RegExp, options?)` | TextInput display value                               |
| `toHaveAccessibilityValue({ min?, max?, now?, text? })` | Accessibility value (partial match)                   |
| `toBeEnabled()` / `toBeDisabled()`                      | Disabled state via `aria-disabled` (checks ancestors) |
| `toBeSelected()`                                        | Selected state via `aria-selected`                    |
| `toBeChecked()` / `toBePartiallyChecked()`              | Checked state via `aria-checked`                      |
| `toBeExpanded()` / `toBeCollapsed()`                    | Expanded state via `aria-expanded`                    |
| `toBeBusy()`                                            | Busy state via `aria-busy`                            |

### Element Style

| Matcher                                | Description                                                     |
| -------------------------------------- | --------------------------------------------------------------- |
| `toBeVisible()`                        | Not hidden (`display: none`, `opacity: 0`, or hidden from a11y) |
| `toHaveStyle(style: StyleProp<ViewStyle | TextStyle | ImageStyle>)` | Specific style match                                            |

### Other

| Matcher                  | Signature                                                      | Description                                                         |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `toHaveAccessibleName()` | `(name?: string \| RegExp, options?: { exact?, normalizer? })` | Accessible name from `aria-label`/`aria-labelledby` or text content |
| `toHaveProp()`           | `(name: string, value?: unknown)`                              | Prop existence/value check (last resort)                            |

---

## Async Utilities

### `waitFor`

```ts
declare function waitFor<T>(
  expectation: () => T,
  options?: { timeout?: number; interval?: number },
): Promise<T>;
```

Runs `expectation` every `interval` (default 50ms) until `timeout` (default 1000ms). Callback must **throw** on failure. Auto-detects and works with Jest fake timers.

Rules:

- No side effects inside callback (no `fireEvent`/`userEvent`)
- One assertion per `waitFor`
- Never pass empty callback
- Prefer `findBy*` over `waitFor` + `getBy*`

### `waitForElementToBeRemoved`

```ts
declare function waitForElementToBeRemoved<T>(
  expectation: () => T,
  options?: { timeout?: number; interval?: number },
): Promise<T>;
```

Waits until the queried element is removed. Element must be initially present.

---

## Other Helpers

### `within`

```ts
declare function within(instance: TestInstance): Queries;
```

Scoped queries on a subtree. Useful for querying within a single `FlatList` item or a specific screen.

```tsx
const item = within(screen.getByTestId('list-item-1'));
expect(item.getByText('Title')).toBeOnTheScreen();
```

### `cleanup`

```ts
declare function cleanup(): Promise<void>;
```

Unmounts rendered trees and clears `screen`. **Async in v14**: await any explicit `cleanup()` call ([upstream implementation](https://github.com/callstack/react-native-testing-library/blob/main/src/cleanup.ts)). Standard imports register cleanup when `afterEach` is available and auto-cleanup is enabled. Avoid duplicate per-test cleanup; explicit cleanup belongs where automatic cleanup is disabled or shared setup must control resource ordering.

---

## renderHook

**Async** in v14:

```ts
declare function renderHook<Result, Props>(
  hookFn: (props: Props) => Result,
  options?: { initialProps?: Props; wrapper?: React.ComponentType<any> },
): Promise<{
  result: { current: Result };
  rerender: (props: Props) => Promise<void>;
  unmount: () => Promise<void>;
}>;
```

There is no `renderHookAsync` in v14. The standard `renderHook` is already async.

Renders a test component that calls the provided hook. Use `act()` when calling functions returned by the hook that trigger state updates.

```tsx
const { result } = await renderHook(() => useCount());
expect(result.current.count).toBe(0);
await act(() => {
  result.current.increment();
});
expect(result.current.count).toBe(1);

// With wrapper
await renderHook(() => useHook(), {
  wrapper: ({ children }) => <Provider>{children}</Provider>,
});
```

---

## act

In v14, `act` always returns a `Promise<T>` and must be awaited, even with sync callbacks:

```ts
declare function act<T>(callback: () => T | Promise<T>): Promise<T>;
```

```tsx
await act(() => {
  result.current.increment();
});
```

Usually not needed — `render`, `fireEvent`, `userEvent`, and `waitFor` handle it internally.

---

## Configuration

```ts
declare function configure(
  options: Partial<{
    asyncUtilTimeout: number; // default timeout for waitFor/findBy* (default: 1000ms)
    defaultIncludeHiddenElements: boolean; // default for includeHiddenElements option (default: false)
    defaultDebugOptions: Partial<DebugOptions>;
  }>,
): void;

declare function resetToDefaults(): void;
```

Note: `concurrentRoot` option is removed (always on). `unstable_validateStringsRenderedWithinText` is removed (always on).

### Environment Variables

| Variable                                 | Description                               |
| ---------------------------------------- | ----------------------------------------- |
| `RNTL_SKIP_AUTO_CLEANUP=true`            | Disable automatic cleanup after each test |
| `RNTL_SKIP_AUTO_DETECT_FAKE_TIMERS=true` | Disable auto-detection of fake timers     |

---

## Accessibility

### `isHiddenFromAccessibility`

```ts
declare function isHiddenFromAccessibility(instance: TestInstance | null): boolean;
```

Also available as `isInaccessible()` alias.

Element is hidden when it or any ancestor has:

- `display: none` style
- `aria-hidden={true}`
- `accessibilityElementsHidden={true}` (iOS)
- `importantForAccessibility="no-hide-descendants"` (Android)
- Sibling with `aria-modal={true}` or `accessibilityViewIsModal={true}` (iOS)

---

## Removed APIs

The following are removed in v14 and must not be used:

- **`renderAsync`** — Use `render` (already async)
- **`fireEventAsync`** — Use `fireEvent` (already async)
- **`renderHookAsync`** — Use `renderHook` (already async)
- **`rerenderAsync` / `unmountAsync`** — Use `rerender` / `unmount` (already async)
- **`update()`** — Use `rerender()`
- **`getQueriesForElement()`** — Use `within()`
- **`UNSAFE_root`** — Use `container` or `root`
- **`UNSAFE_getByType`**, **`UNSAFE_getAllByType`**, **`UNSAFE_queryByType`**, **`UNSAFE_queryAllByType`** — Removed
- **`UNSAFE_getByProps`**, **`UNSAFE_getAllByProps`**, **`UNSAFE_queryByProps`**, **`UNSAFE_queryAllByProps`** — Removed
- **`createNodeMock` option** — Mock the native/component boundary instead
- **`concurrentRoot` option** — Always on
- **`unstable_validateStringsRenderedWithinText` option** — Always on

---

## Migration Codemods

Use RNTL codemods to automate migration from v13:

- **`rntl-v14-update-deps`** — Updates `react-test-renderer` to `test-renderer` in `package.json`
- **`rntl-v14-async-functions`** — Adds `await` to `render`, `fireEvent`, `rerender`, `unmount`, `renderHook`, and `act` calls
