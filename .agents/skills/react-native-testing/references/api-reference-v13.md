# RNTL v13 API Reference

API reference for `@testing-library/react-native` v13.x (React 18.2+), checked against this repository's installed v13.3.3 types and implementation. [Official v13 docs](https://oss.callstack.com/react-native-testing-library/13.x/docs/api).

**Test renderer:** `react-test-renderer`
**Element type:** `ReactTestInstance`

The declarations below summarize public API shapes; executable examples assume app components/providers are imported. Verify exports against the installed patch version.

## Table of Contents

- Core Pattern
- render / renderAsync
- screen
- Queries
- User Event
- Fire Event / fireEventAsync
- Jest Matchers
- Async Utilities
- Other Helpers
- renderHook / renderHookAsync
- Configuration
- Accessibility
- React 19 Compatibility (v13.3+)
- Available Legacy APIs

---

## Core Pattern

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';

jest.useFakeTimers(); // recommended when using userEvent

test('description', async () => {
  const user = userEvent.setup();
  render(<Component />); // sync in v13

  const button = screen.getByRole('button', { name: 'Submit' });
  await user.press(button);

  expect(screen.getByText('Done')).toBeOnTheScreen();
});
```

---

## render / renderAsync

```ts
declare function render(component: React.ReactElement<any>, options?: RenderOptions): RenderResult;
```

`render` is **synchronous** in v13. Returns helpers and queries immediately.

### renderAsync (v13.3+)

```ts
declare function renderAsync(
  component: React.ReactElement<any>,
  options?: RenderAsyncOptions,
): Promise<Awaited<RenderAsyncResult>>;
```

Use `renderAsync` when the initial render needs to await React 19/Suspense work. Pair it with `rerenderAsync` and `unmountAsync`. Integration helpers that own rendering follow their own public API.

### Options

| Option                                       | Type                                  | Description                                                   |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `wrapper`                                    | `React.ComponentType<any>`            | Wraps tested component (useful for context providers)         |
| `concurrentRoot`                             | `boolean`                             | Set `false` to disable concurrent rendering (default: `true`) |
| `createNodeMock`                             | `(element: React.ReactElement) => unknown` | Custom mock refs for `ReactTestRenderer.create()`             |
| `unstable_validateStringsRenderedWithinText` | `boolean`                             | Experimental: replicate RN `Text` string validation           |

### Example

```tsx
import { render, renderAsync, screen } from '@testing-library/react-native';

render(<MyApp />);
expect(screen.getByRole('button', { name: 'start' })).toBeOnTheScreen();

// With wrapper
render(<MyComponent />, {
  wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
});

// Async (React 19 / Suspense)
await renderAsync(<SuspenseComponent />);
```

---

## screen

```ts
type Screen = Queries & {
  rerender(element: React.ReactElement<unknown>): void;          // sync
  rerenderAsync(element: React.ReactElement<unknown>): Promise<void>;  // v13.3+
  unmount(): void;                                            // sync
  unmountAsync(): Promise<void>;                              // v13.3+
  debug(options?: { message?: string; mapProps?: MapPropsFunction }): void;
  toJSON(): ReactTestRendererJSON | ReactTestRendererJSON[] | null;
  root: ReactTestInstance;        // root host element
  UNSAFE_root: ReactTestInstance; // root composite element (avoid)
};
```

The `screen` object provides queries and utilities for the currently rendered UI. Assigned after `render()`, cleared after each test via auto-cleanup.

### Methods

- **`rerender(element)`** — Re-render with new root element (sync). Triggers lifecycle events.
- **`rerenderAsync(element)`** — Async version for React 19 / Suspense (v13.3+).
- **`unmount()`** — Unmount the tree (sync). Usually not needed (auto-cleanup).
- **`unmountAsync()`** — Async version for React 19 / Suspense (v13.3+).
- **`debug({ message?, mapProps? })`** — Pretty-print the rendered tree. Use `mapProps` to filter/transform props in output.
- **`toJSON()`** — Get JSON representation (for snapshot testing).
- **`root`** — The rendered root host element (`ReactTestInstance`).
- **`UNSAFE_root`** — Root composite element. Avoid; use proper queries instead.

---

## Queries

Each query = **variant** + **predicate** (e.g., `getByRole` = `getBy` + `ByRole`).

### Query Variants

| Variant       | Assertion          | Return Type                                | Async |
| ------------- | ------------------ | ------------------------------------------ | ----- |
| `getBy*`      | Exactly one match  | `ReactTestInstance` (throws if 0 or >1)    | No    |
| `getAllBy*`   | At least one match | `ReactTestInstance[]` (throws if 0)        | No    |
| `queryBy*`    | Zero or one match  | `ReactTestInstance \| null` (throws if >1) | No    |
| `queryAllBy*` | No assertion       | `ReactTestInstance[]` (empty if 0)         | No    |
| `findBy*`     | Exactly one match  | `Promise<ReactTestInstance>`               | Yes   |
| `findAllBy*`  | At least one match | `Promise<ReactTestInstance[]>`             | Yes   |

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
}): ReactTestInstance;
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
declare function getByLabelText(text: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): ReactTestInstance;
```

Matches by `aria-label`/`accessibilityLabel` or text content of element referenced by `aria-labelledby`/`accessibilityLabelledBy`.

#### `*ByPlaceholderText`

```ts
declare function getByPlaceholderText(text: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): ReactTestInstance;
```

Matches `TextInput` by `placeholder` prop.

#### `*ByText`

```ts
declare function getByText(text: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): ReactTestInstance;
```

Matches by text content. Joins `<Text>` siblings to find matches (like RN runtime).

#### `*ByDisplayValue`

```ts
declare function getByDisplayValue(value: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): ReactTestInstance;
```

Matches `TextInput` by current display value.

#### `*ByHintText`

```ts
declare function getByHintText(hint: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): ReactTestInstance;
```

Matches by `accessibilityHint` prop. Also available as `getByA11yHint` / `getByAccessibilityHint`.

#### `*ByTestId` (last resort)

```ts
declare function getByTestId(testId: TextMatch, options?: { exact?: boolean; normalizer?: Function; includeHiddenElements?: boolean }): ReactTestInstance;
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

## Fire Event / fireEventAsync

Use when `userEvent` doesn't support the event or when triggering events on composite elements.

### fireEvent (sync)

```ts
declare function fireEvent(element: ReactTestInstance, eventName: string, ...data: unknown[]): void;
```

Traverses tree bottom-up looking for `onXxx` handler. Does **not** auto-pass event data.

#### Convenience Methods

```ts
fireEvent.press(element, eventData); // event data is optional
fireEvent.changeText(textInput, 'New text');
fireEvent.scroll(scrollView, scrollEvent); // supply nativeEvent data
```

### fireEventAsync (v13.3+, for React 19 / Suspense)

```ts
declare function fireEventAsync(
  element: ReactTestInstance,
  eventName: string,
  ...data: unknown[]
): Promise<undefined>;

await fireEventAsync.press(element, eventData);
await fireEventAsync.changeText(textInput, 'New text');
await fireEventAsync.scroll(scrollView, scrollEvent);
```

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
| `toContainElement()`  | `(element: ReactTestInstance \| null)`                        | Contains child element      |
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

### `within` / `getQueriesForElement`

```ts
declare function within(element: ReactTestInstance): Queries;
```

Scoped queries on a subtree. Useful for querying within a single `FlatList` item or a specific screen.

```tsx
const item = within(screen.getByTestId('list-item-1'));
expect(item.getByText('Title')).toBeOnTheScreen();
```

### `act`

```ts
// React 19: the wrapper follows React.act's thenable-based API.
const updateResult = act(() => {
  result.current.increment();
});
await updateResult;
```

Wraps `React.act` when available, falling back to `react-test-renderer.act`. Await async work and externally triggered React updates; avoid redundant wrappers around RNTL helpers.

### `cleanup`

```ts
declare function cleanup(): void;
declare function cleanupAsync(): Promise<void>;
```

Unmounts rendered trees and clears `screen`. Standard imports register async auto-cleanup when `afterEach` is available and auto-cleanup is enabled. For explicit async rendering teardown, await `cleanupAsync()`. Avoid duplicate per-test cleanup; explicit cleanup belongs where automatic cleanup is disabled or shared setup must control resource ordering.

---

## renderHook / renderHookAsync

### renderHook (sync)

```ts
declare function renderHook<Result, Props>(
  hookFn: (props: Props) => Result,
  options?: {
    initialProps?: Props;
    wrapper?: React.ComponentType<any>;
    concurrentRoot?: boolean;
  },
): {
  result: { current: Result };
  rerender: (props: Props) => void;
  unmount: () => void;
};
```

### renderHookAsync (v13.3+)

```ts
declare function renderHookAsync<Result, Props>(
  hookFn: (props: Props) => Result,
  options?: {
    initialProps?: Props;
    wrapper?: React.ComponentType<any>;
    concurrentRoot?: boolean;
  },
): Promise<{
  result: { current: Result };
  rerenderAsync: (props: Props) => Promise<void>;
  unmountAsync: () => Promise<void>;
}>;
```

Renders a test component that calls the provided hook. Use `act()` when calling functions returned by the hook that trigger state updates.

```tsx
const { result } = renderHook(() => useCount());
expect(result.current.count).toBe(0);
await act(() => {
  result.current.increment();
});
expect(result.current.count).toBe(1);

// With wrapper
renderHook(() => useHook(), {
  wrapper: ({ children }) => <Provider>{children}</Provider>,
});
```

---

## Configuration

```ts
declare function configure(
  options: Partial<{
    asyncUtilTimeout: number; // default timeout for waitFor/findBy* (default: 1000ms)
    defaultIncludeHiddenElements: boolean; // default for includeHiddenElements option (default: false)
    defaultDebugOptions: Partial<DebugOptions>;
    concurrentRoot: boolean; // default concurrent rendering (default: true)
  }>,
): void;

declare function resetToDefaults(): void;
```

### Environment Variables

| Variable                                 | Description                               |
| ---------------------------------------- | ----------------------------------------- |
| `RNTL_SKIP_AUTO_CLEANUP=true`            | Disable automatic cleanup after each test |
| `RNTL_SKIP_AUTO_DETECT_FAKE_TIMERS=true` | Disable auto-detection of fake timers     |

---

## Accessibility

### `isHiddenFromAccessibility`

```ts
declare function isHiddenFromAccessibility(element: ReactTestInstance | null): boolean;
```

Also available as `isInaccessible()` alias.

Element is hidden when it or any ancestor has:

- `display: none` style
- `aria-hidden={true}`
- `accessibilityElementsHidden={true}` (iOS)
- `importantForAccessibility="no-hide-descendants"` (Android)
- Sibling with `aria-modal={true}` or `accessibilityViewIsModal={true}` (iOS)

---

## React 19 Compatibility (v13.3+)

For direct renders that need to await React 19/Suspense work, use the async variants:

```tsx
import { renderAsync, screen, fireEventAsync } from '@testing-library/react-native';

test('async component', async () => {
  await renderAsync(<SuspenseComponent />);
  await fireEventAsync.press(screen.getByRole('button'));
  expect(screen.getByText('Result')).toBeOnTheScreen();
});
```

Use `rerenderAsync`/`unmountAsync` instead of `rerender`/`unmount` when using `renderAsync`.

---

## Available Legacy APIs

These aliases and UNSAFE queries are available in v13. Deprecated aliases should be replaced with standard names; UNSAFE queries expose implementation details and are reserved for justified boundaries:

- **`update(element)`** — Alias for `rerender`. Use `rerender()` instead.
- **`getQueriesForElement(element)`** — Alias for `within`. Use `within()` instead.
- **`UNSAFE_getByType`**, **`UNSAFE_getAllByType`**, **`UNSAFE_queryByType`**, **`UNSAFE_queryAllByType`** — Query by React component type. Use proper queries instead.
- **`UNSAFE_getByProps`**, **`UNSAFE_getAllByProps`**, **`UNSAFE_queryByProps`**, **`UNSAFE_queryAllByProps`** — Query by props. Use proper queries instead.
