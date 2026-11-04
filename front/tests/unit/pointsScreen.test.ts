/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');
type Tree = { type: unknown; props: Record<string, any> };
type PointItem = {
  uuid: string; transactionType: string; amount: number; balanceAfter: number;
  createdAt: string; episode: { dramaTitle: string; episodeNumber: number } | null;
};
type PointPage = { items: PointItem[]; page: number; hasNext: boolean };
type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function createPointsScreen(initialTab: string | null = null) {
  const requests: Deferred<PointPage>[] = [];
  const requestPages: number[] = [];
  const routes: unknown[] = [];
  const setPointsCalls: number[] = [];
  let user: { uuid: string } | null = null;
  let points: number | null = 2000;
  let isRestoring = true;
  let sessionVersion = 0;
  let tabParam = initialTab;
  let tree: Tree;
  let hook = 0;
  let dirty = false;
  const states: unknown[] = [];
  const refs: Array<{ current: any }> = [];
  const callbacks: Array<{ callback: (...args: any[]) => any; deps: unknown[] }> = [];
  const effects: Array<{ effect: () => void | (() => void); deps?: unknown[]; cleanup?: () => void; pending?: boolean }> = [];
  let focusCallback: (() => void | (() => void)) | null = null;
  let focusCleanup: (() => void) | undefined;
  let focusDirty = false;
  const isCurrentSession = (version: number) => version === sessionVersion;
  const jsx = (type: unknown, props: Record<string, any>): Tree => ({ type, props });
  const react = {
    useState<T>(initial: T | (() => T)) {
      const index = hook++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
      return [states[index] as T, (next: T | ((previous: T) => T)) => {
        states[index] = typeof next === 'function' ? (next as (previous: T) => T)(states[index] as T) : next;
        dirty = true;
      }] as const;
    },
    useRef<T>(initial: T) { const index = hook++; refs[index] ??= { current: initial }; return refs[index] as { current: T }; },
    useCallback<T extends (...args: any[]) => any>(callback: T, deps: unknown[] = []) {
      const index = hook++;
      const prior = callbacks[index];
      if (prior && deps.length === prior.deps.length && deps.every((value, i) => Object.is(value, prior.deps[i]))) return prior.callback as T;
      callbacks[index] = { callback, deps };
      return callback;
    },
    useMemo<T>(factory: () => T, deps: unknown[]) {
      const index = hook++;
      const prior = callbacks[index];
      if (prior && deps.length === prior.deps.length && deps.every((value, i) => Object.is(value, prior.deps[i]))) return prior.callback as T;
      const value = factory();
      callbacks[index] = { callback: value as any, deps };
      return value;
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = hook++;
      const prior = effects[index];
      if (!prior || deps === undefined || deps.length !== prior.deps?.length || deps.some((value, i) => !Object.is(value, prior.deps?.[i]))) {
        effects[index] = { effect, deps, cleanup: prior?.cleanup, pending: true };
      }
    },
  };
  const passthrough = (name: string) => name;
  const modules: Record<string, any> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { FlatList: 'FlatList', Pressable: 'Pressable', StyleSheet: { create: (value: unknown) => value }, View: 'View' },
    'expo-router': {
      useLocalSearchParams: () => ({ tab: tabParam }),
      useRouter: () => ({ canGoBack: () => false, back() {}, replace: (route: unknown) => routes.push(route), push: (route: unknown) => routes.push(route) }),
      useFocusEffect(callback: () => void | (() => void)) {
        if (focusCallback !== callback) { focusDirty = true; focusCallback = callback; }
      },
    },
    '@/components/ui': { AppText: passthrough('AppText'), Button: passthrough('Button'), EmptyState: passthrough('EmptyState'), Icon: passthrough('Icon'), Page: passthrough('Page'), SectionTitle: passthrough('SectionTitle') },
    '@/common/theme/tokens': { colors: { background: '#000', surface: '#111', elevated: '#222', muted: '#aaa', text: '#fff', border: '#333', accent: '#f90' } },
    '@/common/http/errorMessages': { getErrorMessage: (error: unknown) => error instanceof Error ? `공통 안내: ${error.message}` : '공통 오류 안내' },
    '@/features/economy/pointHistory': { getPointHistory: (page = 1) => {
      const request = deferred<PointPage>(); requests.push(request); requestPages.push(page); return request.promise;
    } },
    '@/features/user/UserProvider': { useUser: () => ({
      user, points, isRestoring, sessionVersion, isCurrentSession,
      setPoints: (value: number) => setPointsCalls.push(value),
    }) },
  };
  const source = readFileSync(resolve(process.cwd(), 'src/screens/PointsScreen.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(output, { require: (id: string) => modules[id], module, exports: module.exports });
  const Screen = module.exports.PointsScreen as () => Tree;

  function render() {
    hook = 0;
    dirty = false;
    tree = Screen();
    if (focusDirty) {
      focusDirty = false;
      focusCleanup?.();
      focusCleanup = focusCallback?.() ?? undefined;
    }
    for (const effect of effects) if (effect?.pending) {
      effect.pending = false;
      effect.cleanup?.();
      effect.cleanup = effect.effect() ?? undefined;
    }
    return tree;
  }
  function refocus() {
    focusCleanup?.();
    focusCleanup = focusCallback?.() ?? undefined;
  }
  function blur() { focusCleanup?.(); focusCleanup = undefined; }
  async function settle() {
    await new Promise<void>((done) => setImmediate(done));
    if (dirty) render();
    await new Promise<void>((done) => setImmediate(done));
    if (dirty) render();
  }
  function find(node: any, type: string): Tree[] {
    if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
    if (!node || typeof node !== 'object') return [];
    const found = node.type === type ? [node as Tree] : [];
    const footer = node.type === 'FlatList' ? node.props.ListFooterComponent : null;
    return found.concat(find(node.props?.children, type),
      find(typeof footer === 'function' ? footer() : footer, type));
  }
  function text() {
    return [
      ...find(tree, 'AppText').map((node) => [node.props.children].flat(Infinity).join('')),
      ...find(tree, 'EmptyState').flatMap((node) => [node.props.title, node.props.description]),
    ].flat(Infinity).join(' ');
  }
  function pressTab(label: string) {
    const tab = find(tree, 'Pressable').find((node) => node.props.accessibilityRole === 'tab'
      && node.props.children?.props?.children === label);
    assert.ok(tab, `expected tab ${label}`);
    (tab.props.onPress as () => void)();
    render();
  }
  function pressButton(label: string) {
    const button = find(tree, 'Button').find((node) => node.props.label === label);
    const emptyAction = find(tree, 'EmptyState').find((node) => node.props.action === label);
    const onPress = button?.props.onPress ?? emptyAction?.props.onAction;
    assert.equal(typeof onPress, 'function', `expected action ${label}`);
    (onPress as () => void)();
    render();
  }
  function footerButtons() {
    const footer = find(tree, 'FlatList')[0]?.props.ListFooterComponent;
    return find(typeof footer === 'function' ? footer() : footer, 'Button');
  }
  function visibleItems() {
    const list = find(tree, 'FlatList')[0];
    return list?.props.data as PointItem[] | undefined;
  }
  function itemLabels(item: PointItem) {
    const list = find(tree, 'FlatList')[0];
    const row = list.props.renderItem({ item });
    return find(row, 'AppText').map((node) => [node.props.children].flat(Infinity).join('')).join(' ');
  }
  function unmount() {
    focusCleanup?.(); focusCleanup = undefined;
    for (const effect of effects) effect?.cleanup?.();
  }
  return {
    requests, requestPages, routes, setPointsCalls, render, settle, find, text, pressTab, pressButton,
    get tree() { return tree; },
    visibleItems, itemLabels, footerButtons, refocus, blur, unmount,
    setSession(nextUser: { uuid: string } | null, restoring: boolean, version: number, nextPoints = points) {
      user = nextUser; isRestoring = restoring; sessionVersion = version; points = nextPoints;
    },
    setTabParam(value: string | null) { tabParam = value; },
  };
}

const pointPage = (items: PointItem[], page = 1, hasNext = false): PointPage => ({ items, page, hasNext });
const tx = (uuid: string, transactionType: string, amount: number, balanceAfter: number,
  episode: PointItem['episode'] = null, createdAt = '2026-11-03T18:04:00.000Z'): PointItem =>
  ({ uuid, transactionType, amount, balanceAfter, createdAt, episode });

test('charge tab keeps the sample packs and does not load history; history route fetches page one', () => {
  const screen = createPointsScreen();
  screen.setSession({ uuid: 'user-a' }, false, 1, 1234);
  screen.render();
  assert.equal(screen.requests.length, 0);
  assert.match(screen.text(), /광고 보고 \+10 P/);
  assert.match(screen.text(), /포인트 충전/);
  assert.match(screen.text(), /1,234 P/);
  assert.match(screen.text(), /100 P/);
  assert.match(screen.text(), /300 P/);
  assert.match(screen.text(), /600 P/);
  assert.match(screen.text(), /₩1,100/);
  assert.equal(screen.find(screen.tree, 'Button').filter((node) => node.props.disabled).length, 4);

  const routed = createPointsScreen('history');
  routed.setSession({ uuid: 'user-a' }, false, 1);
  routed.render();
  assert.deepEqual(routed.requestPages, [1]);
  assert.equal(routed.find(routed.tree, 'Page')[0]?.props.scroll, false);
});

test('history waits for session restoration, prompts anonymous users to log in, then loads', () => {
  const screen = createPointsScreen('history');
  screen.render();
  assert.equal(screen.requests.length, 0);
  assert.match(screen.text(), /로그인 상태를 확인하고 있어요/);
  screen.setSession(null, false, 1, null);
  screen.render();
  assert.equal(screen.requests.length, 0);
  assert.match(screen.text(), /로그인/);
  screen.pressButton('로그인');
  assert.deepEqual(JSON.parse(JSON.stringify(screen.routes)), ['/login']);
  screen.setSession({ uuid: 'user-a' }, true, 2);
  screen.render();
  assert.equal(screen.requests.length, 0, 'history waits while session restoration is pending');
  screen.setSession({ uuid: 'user-a' }, false, 2);
  screen.render();
  assert.deepEqual(screen.requestPages, [1]);
});

test('history renders each transaction label, signed amount, balance, episode, and Seoul time', async () => {
  const screen = createPointsScreen('history');
  screen.setSession({ uuid: 'user-a' }, false, 1, 2000);
  screen.render();
  assert.match(screen.text(), /불러오는/);
  const items = [
    tx('purchase', 'PURCHASE', 1000, 1000),
    tx('ad', 'AD_REWARD', 10, 1010),
    tx('unlock', 'EPISODE_UNLOCK', -30, 980, { dramaTitle: '달빛 아래', episodeNumber: 2 }),
    tx('admin', 'ADMIN_ADJUSTMENT', -5, 975),
    tx('refund', 'REFUND', 30, 1005, null, '2026-11-03T15:00:00.000Z'),
    tx('midnight', 'AD_REWARD', 1, 1006, null, '2026-11-03T15:00:00.000Z'),
  ];
  screen.requests[0].resolve(pointPage(items));
  await screen.settle();
  assert.deepEqual(Array.from(screen.visibleItems() ?? [], (item) => item.uuid), items.map((item) => item.uuid));
  const labels = items.map((item) => screen.itemLabels(item));
  for (const [index, label] of ['포인트 충전', '광고 보상', '회차 구매', '관리자 조정', '환불', '광고 보상'].entries()) assert.match(labels[index], new RegExp(label));
  assert.match(labels[0], /\+1,000 P/);
  assert.match(labels[1], /\+10 P/);
  assert.match(labels[2], /-30 P/);
  assert.match(labels[3], /-5 P/);
  assert.match(labels[4], /\+30 P/);
  assert.match(labels[2], /980 P/);
  assert.match(labels[2], /달빛 아래/);
  assert.match(labels[2], /2화/);
  assert.doesNotMatch(labels[0], /달빛 아래|화/);
  assert.match(labels[1], /2026\.11\.04 03:04/);
  assert.match(labels[4], /2026\.11\.04 00:00/);
  assert.equal(screen.text().includes('2,000 P'), true, 'current balance remains visible');
  assert.deepEqual(screen.setPointsCalls, [], 'historical balanceAfter never replaces current points');
});

test('empty and failed first pages have distinct states and retry page one', async () => {
  const empty = createPointsScreen('history');
  empty.setSession({ uuid: 'user-a' }, false, 1);
  empty.render();
  empty.requests[0].resolve(pointPage([]));
  await empty.settle();
  assert.match(empty.text(), /내역이 없/);

  const failed = createPointsScreen('history');
  failed.setSession({ uuid: 'user-a' }, false, 1);
  failed.render();
  failed.requests[0].reject(new Error('offline'));
  await failed.settle();
  assert.match(failed.text(), /공통 안내: offline/);
  failed.pressButton('다시 시도');
  assert.deepEqual(failed.requestPages, [1, 1]);
  failed.requests[1].resolve(pointPage([tx('ok', 'PURCHASE', 100, 100)]));
  await failed.settle();
  assert.deepEqual(Array.from(failed.visibleItems() ?? [], (item) => item.uuid), ['ok']);
});

test('pagination prevents duplicate loads, retries the same page, deduplicates UUIDs, and stops at the end', async () => {
  const screen = createPointsScreen('history');
  screen.setSession({ uuid: 'user-a' }, false, 1);
  screen.render();
  const first = tx('tx-1', 'EPISODE_UNLOCK', -30, 970, { dramaTitle: '작품', episodeNumber: 1 });
  screen.requests[0].resolve(pointPage([first], 1, true));
  await screen.settle();
  const loadMore = screen.footerButtons().find((node) => node.props.label === '더 보기');
  assert.ok(loadMore);
  (loadMore.props.onPress as () => void)();
  (loadMore.props.onPress as () => void)();
  screen.render();
  assert.deepEqual(screen.requestPages, [1, 2]);
  screen.requests[1].reject(new Error('offline'));
  await screen.settle();
  assert.deepEqual(Array.from(screen.visibleItems() ?? [], (item) => item.uuid), ['tx-1']);
  assert.match(screen.text(), /공통 안내: offline/);
  const retry = screen.footerButtons().find((node) => node.props.label === '다시 시도');
  assert.ok(retry);
  (retry.props.onPress as () => void)();
  screen.render();
  assert.deepEqual(screen.requestPages, [1, 2, 2]);
  screen.requests[2].resolve(pointPage([first, tx('tx-2', 'AD_REWARD', 10, 980)], 2, false));
  await screen.settle();
  assert.deepEqual(Array.from(screen.visibleItems() ?? [], (item) => item.uuid), ['tx-1', 'tx-2']);
  assert.equal(screen.footerButtons().some((node) => node.props.label === '더 보기'), false);
});

test('account changes hide old rows immediately and late responses cannot replace the new account', async () => {
  const screen = createPointsScreen('history');
  screen.setSession({ uuid: 'user-a' }, false, 1);
  screen.render();
  screen.requests[0].resolve(pointPage([tx('a-1', 'PURCHASE', 100, 100)], 1, true));
  await screen.settle();
  screen.pressButton('더 보기');
  assert.deepEqual(screen.requestPages, [1, 2]);
  screen.setSession({ uuid: 'user-b' }, false, 2);
  screen.render();
  assert.equal(screen.find(screen.tree, 'FlatList').length, 0, 'account A rows are hidden before account B responds');
  assert.deepEqual(screen.requestPages, [1, 2, 1]);
  screen.requests[1].resolve(pointPage([tx('a-late', 'PURCHASE', 999, 999)], 2));
  await screen.settle();
  assert.equal(screen.find(screen.tree, 'FlatList').length, 0);
  screen.requests[2].resolve(pointPage([tx('b-1', 'AD_REWARD', 10, 10)]));
  await screen.settle();
  assert.deepEqual(Array.from(screen.visibleItems() ?? [], (item) => item.uuid), ['b-1']);
});

test('tab changes, blur, unmount, and refocus invalidate stale work and refresh from page one', async () => {
  const changedTab = createPointsScreen('history');
  changedTab.setSession({ uuid: 'user-a' }, false, 1);
  changedTab.render();
  changedTab.pressTab('충전하기');
  changedTab.requests[0].reject(new Error('late tab error'));
  await changedTab.settle();
  assert.equal(changedTab.text().includes('공통 안내: late tab error'), false);
  assert.equal(changedTab.requests.length, 1);

  const blurred = createPointsScreen('history');
  blurred.setSession({ uuid: 'user-a' }, false, 1);
  blurred.render();
  blurred.blur();
  blurred.requests[0].resolve(pointPage([tx('late', 'PURCHASE', 10, 10)]));
  await blurred.settle();
  assert.equal(blurred.find(blurred.tree, 'FlatList').length, 0);

  const unmounted = createPointsScreen('history');
  unmounted.setSession({ uuid: 'user-a' }, false, 1);
  unmounted.render();
  unmounted.unmount();
  unmounted.requests[0].resolve(pointPage([tx('late', 'PURCHASE', 10, 10)]));
  await unmounted.settle();
  assert.equal(unmounted.find(unmounted.tree, 'FlatList').length, 0);

  const refocused = createPointsScreen('history');
  refocused.setSession({ uuid: 'user-a' }, false, 1);
  refocused.render();
  refocused.requests[0].resolve(pointPage([tx('old', 'PURCHASE', 10, 10)], 1, true));
  await refocused.settle();
  refocused.refocus();
  refocused.render();
  assert.deepEqual(refocused.requestPages, [1, 1]);
  assert.equal(refocused.find(refocused.tree, 'FlatList').length, 0, 'focus refresh starts with a clean page-one result');
  refocused.requests[1].resolve(pointPage([tx('fresh', 'REFUND', 30, 40)]));
  await refocused.settle();
  assert.deepEqual(Array.from(refocused.visibleItems() ?? [], (item) => item.uuid), ['fresh']);
});

test('direct history route param changes reloads history without changing the current points balance', () => {
  const screen = createPointsScreen();
  screen.setSession({ uuid: 'user-a' }, false, 1, 4321);
  screen.render();
  assert.equal(screen.requests.length, 0);
  screen.setTabParam('history');
  screen.render();
  assert.deepEqual(screen.requestPages, [1]);
  assert.match(screen.text(), /4,321 P/);
  assert.deepEqual(screen.setPointsCalls, []);
});
