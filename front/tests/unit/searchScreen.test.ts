import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');
type Node = { type: unknown; props: Record<string, any>; key?: string };
type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const requests: Deferred<typeof dramas>[] = [];
  let user: { uuid: string } | null = null;
  let isRestoring = true;
  let sessionVersion = 0;
  let tree: Node;
  let hook = 0;
  let dirty = false;
  const states: unknown[] = [];
  const refs: Array<{ current: any }> = [];
  const callbacks: Array<{ callback: (...args: any[]) => any; deps: unknown[] }> = [];
  const effects: Array<{ effect: () => void | (() => void); deps?: unknown[]; cleanup?: () => void; pending?: boolean }> = [];
  let focusCallback: (() => void | (() => void)) | null = null;
  let activeFocusCallback: (() => void | (() => void)) | null = null;
  let focusCleanup: (() => void) | undefined;
  let focused = true;
  let focusChanged = false;
  const pushes: unknown[] = [];
  const isCurrentSession = (version: number) => version === sessionVersion;
  class SessionChangedError extends Error {}
  const jsx = (type: unknown, props: Record<string, any>, key?: string): Node => ({ type, props, key });
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
    useMemo<T>(factory: () => T) { hook++; return factory(); },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = hook++;
      const prior = effects[index];
      if (!prior || deps === undefined || deps.length !== prior.deps?.length || deps.some((value, i) => !Object.is(value, prior.deps?.[i]))) {
        effects[index] = { effect, deps, cleanup: prior?.cleanup, pending: true };
      }
    },
  };
  const passthrough = (name: string) => (props: Record<string, any>) => jsx(name, props);
  const modules: Record<string, any> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (value: unknown) => value, absoluteFill: {} }, TextInput: 'TextInput', View: 'View', useWindowDimensions: () => ({ width: 400 }) },
    'expo-image': { Image: 'Image' },
    'expo-router': {
      useLocalSearchParams: () => ({}),
      useRouter: () => ({ push: (route: unknown) => pushes.push(route) }),
      useFocusEffect(callback: () => void | (() => void)) {
        if (focusCallback !== callback) { focusCallback = callback; focusChanged = true; }
      },
    },
    '@/components/ui': { AppText: passthrough('AppText'), EmptyState: passthrough('EmptyState'), Icon: passthrough('Icon'), Page: passthrough('Page'), SectionTitle: passthrough('SectionTitle') },
    '@/components/AppTopBar': { AppTopBar: 'AppTopBar' },
    '@/common/http/errorMessages': { getErrorMessage: (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했습니다.' },
    '@/common/media': { resolveApiImageUrl: (value: unknown) => value },
    '@/common/theme/tokens': { colors: { background: '#000', accent: '#0f0', muted: '#aaa', text: '#fff', surface: '#111', border: '#333' }, typography: { regular: 'regular' } },
    '@/features/drama/dramaContent': { getDramaList: () => { const request = deferred<typeof dramas>(); requests.push(request); return request.promise; } },
    '@/features/user/UserProvider': { useUser: () => ({ user, isRestoring, sessionVersion, isCurrentSession }) },
    '@/common/http/api': { SessionChangedError },
  };
  const source = readFileSync(resolve(process.cwd(), 'src/screens/SearchScreen.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(compiled, { exports: module.exports, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected module: ${id}`);
    return modules[id];
  } }, { filename: 'SearchScreen.js' });
  const Screen = module.exports.SearchScreen as () => Node;

  function render() {
    let iterations = 0;
    do {
      dirty = false;
      hook = 0;
      tree = Screen();
      if (focusChanged) {
        focusChanged = false;
        if (activeFocusCallback !== focusCallback) {
          focusCleanup?.();
          activeFocusCallback = focusCallback;
          focusCleanup = focused ? focusCallback?.() ?? undefined : undefined;
        }
      }
      for (const effect of effects) if (effect?.pending) {
        effect.pending = false;
        effect.cleanup?.();
        effect.cleanup = effect.effect() ?? undefined;
      }
      iterations += 1;
      assert.ok(iterations < 10, 'component hooks did not settle');
    } while (dirty);
    return tree;
  }
  function find(node: unknown, type: string, label?: string): Node[] {
    if (Array.isArray(node)) return node.flatMap((child) => find(child, type, label));
    if (!node || typeof node !== 'object') return [];
    const current = node as Node;
    if (typeof current.type === 'function') return find((current.type as (props: Record<string, any>) => unknown)(current.props), type, label);
    const found = current.type === type && (label === undefined || current.props.accessibilityLabel === label) ? [current] : [];
    return found.concat(find(current.props?.children, type, label));
  }
  async function settle() {
    await new Promise<void>((done) => setImmediate(done));
    if (dirty) render();
    await new Promise<void>((done) => setImmediate(done));
    if (dirty) render();
  }
  function session(nextUser: { uuid: string } | null, restoring = false, version = sessionVersion + 1) {
    user = nextUser;
    isRestoring = restoring;
    sessionVersion = version;
    render();
  }
  return {
    requests, render, settle, find, get tree() { return tree; },
    session,
    blur() { focused = false; focusCleanup?.(); focusCleanup = undefined; },
    focus() { focused = true; focusCleanup = focusCallback?.() ?? undefined; },
    unmount() { focusCleanup?.(); for (const effect of effects) effect?.cleanup?.(); },
  };
}

const dramas = [
  { uuid: 'drama-1', slug: 'one', title: '첫 작품', shortDescription: '소개', productionCompany: null, genres: [{ id: 1, code: 'romance', name: '로맨스' }], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] }, previewVideos: [], episodeCount: 1, freeEpisodeCount: 1 },
  { uuid: 'drama-2', slug: 'two', title: '둘째 작품', shortDescription: '소개', productionCompany: null, genres: [{ id: 2, code: 'action', name: '액션' }], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] }, previewVideos: [], episodeCount: 1, freeEpisodeCount: 1 },
];

test('search waits for session restore and recovers with anonymous results after expiration', async () => {
  const screen = setup();
  screen.render();
  assert.equal(screen.requests.length, 0);
  screen.session({ uuid: 'account-a' }, false, 1);
  assert.equal(screen.requests.length, 1);
  screen.session(null, false, 2);
  assert.equal(screen.requests.length, 2);
  screen.requests[1].resolve(dramas);
  await screen.settle();
  assert.ok(screen.find(screen.tree, 'Pressable', '첫 작품 작품 소개').length);
  screen.requests[0].reject(new Error('expired request rejected'));
  await screen.settle();
  assert.ok(screen.find(screen.tree, 'Pressable', '첫 작품 작품 소개').length);
  screen.unmount();
});

test('search keeps filters on focus refetch and retry, and ignores stale account responses', async () => {
  const screen = setup();
  screen.session({ uuid: 'account-a' }, false, 1);
  screen.requests[0].resolve(dramas);
  await screen.settle();
  const query = screen.find(screen.tree, 'TextInput', '작품 제목이나 장르 검색')[0];
  query.props.onChangeText('둘째');
  const genre = screen.find(screen.tree, 'Pressable').find((node) => node.props.accessibilityState?.selected === false && node.props.children?.props?.children === '액션');
  if (genre) genre.props.onPress();
  screen.render();

  screen.blur();
  screen.focus();
  assert.equal(screen.requests.length, 2);
  screen.session({ uuid: 'account-b' }, false, 2);
  assert.equal(screen.requests.length, 3);
  screen.requests[1].resolve([]);
  await screen.settle();
  const loading = screen.find(screen.tree, 'EmptyState')[0];
  assert.ok(loading, 'expected a loading state after an account change');
  assert.equal(loading.props.title, '작품을 불러오는 중');
  screen.requests[2].reject(new Error('offline'));
  await screen.settle();
  const error = screen.find(screen.tree, 'EmptyState')[0];
  assert.ok(error, 'expected an error state after the current account request fails');
  assert.equal(error.props.action, '다시 시도');
  assert.match(error.props.description, /offline/);
  const currentQuery = screen.find(screen.tree, 'TextInput', '작품 제목이나 장르 검색')[0];
  assert.ok(currentQuery, 'search input should remain mounted during an error');
  assert.equal(currentQuery.props.value, '둘째');
  error.props.onAction();
  screen.render();
  assert.equal(screen.requests.length, 4);
  screen.requests[3].resolve([]);
  await screen.settle();
  const empty = screen.find(screen.tree, 'EmptyState')[0];
  assert.ok(empty, 'expected an empty state after a successful empty response');
  assert.equal(empty.props.title, '아직 찾는 이야기가 없어요');
  screen.unmount();
});

test('search does not request while restoring and re-requests when focused again', () => {
  const screen = setup();
  screen.session(null, true, 0);
  assert.equal(screen.requests.length, 0);
  screen.session(null, false, 1);
  assert.equal(screen.requests.length, 1);
  screen.blur();
  screen.focus();
  assert.equal(screen.requests.length, 2);
  screen.unmount();
});
