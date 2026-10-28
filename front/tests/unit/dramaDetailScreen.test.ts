import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');
type Node = { type: unknown; props: Record<string, unknown>; key?: string };

function createScreen() {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/DramaDetailScreen.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const state: unknown[] = [];
  const effects: { effect: () => void | (() => void); deps?: unknown[]; cleanup?: () => void }[] = [];
  let hook = 0;
  let tree: Node | null = null;
  let dirty = false;
  let user: { uuid: string } | null = null;
  let sessionVersion = 0;
  let isRestoring = false;
  let requests: { id: string; resolve: (content: typeof drama) => void; reject: (error: Error) => void }[] = [];
  const pushes: unknown[] = [];
  let dialogProps: Record<string, unknown> | null = null;
  class ApiErrorMock extends Error {
    constructor(public status: number, public errorCode: string | null = null) { super(errorCode ?? `HTTP_${status}`); }
  }
  const isCurrentSession = (version: number) => sessionVersion === version;
  const jsx = (type: unknown, props: Record<string, unknown>, key?: string): Node => ({ type, props, key });
  const react = {
    useState<T>(initial: T | (() => T)) {
      const index = hook++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
      return [state[index] as T, (value: T | ((previous: T) => T)) => {
        state[index] = typeof value === 'function' ? (value as (previous: T) => T)(state[index] as T) : value;
        dirty = true;
      }] as const;
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = hook++;
      const prior = effects[index];
      if (!prior || deps?.some((value, position) => !Object.is(value, prior.deps?.[position])) || (deps === undefined && prior.deps !== undefined)) {
        effects[index] = { effect, deps, cleanup: prior?.cleanup };
      }
    },
  };
  const passthrough = (name: string) => (props: Record<string, unknown>) => jsx(name, props);
  const dialog = (props: Record<string, unknown>) => { dialogProps = props; return jsx('EpisodeUnlockDialog', props); };
  const modules: Record<string, unknown> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: (value: unknown) => value, absoluteFill: {} }, View: 'View' },
    'expo-image': { Image: 'Image' },
    'expo-router': { useLocalSearchParams: () => ({ tab: 'episodes' }), useRouter: () => ({ canGoBack: () => true, back() {}, replace() {}, push: (value: unknown) => pushes.push(value) }) },
    '@/components/ui': { AppText: passthrough('AppText'), EmptyState: passthrough('EmptyState'), Icon: passthrough('Icon'), Page: passthrough('Page') },
    '@/components/EpisodeUnlockDialog': { EpisodeUnlockDialog: dialog },
    '@/common/media': { resolveApiImageUrl: (value: unknown) => value },
    '@/common/http/api': { ApiError: ApiErrorMock, SessionChangedError: class SessionChangedError extends Error {} },
    '@/common/http/errorMessages': { getErrorMessage: () => '요청을 처리하지 못했습니다.' },
    '@/common/theme/tokens': { colors: { muted: '#aaa', accent: '#0f0', text: '#fff', surface: '#111', border: '#333' } },
    '@/features/drama/dramaContent': { getDramaContent: (id: string) => new Promise((resolve, reject) => requests.push({ id, resolve, reject })) },
    '@/features/user/UserProvider': { useUser: () => ({ user, isRestoring, sessionVersion, isCurrentSession }) },
  };
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(compiled, { exports: module.exports, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected module: ${id}`);
    return modules[id];
  } }, { filename: 'DramaDetailScreen.js' });
  const Component = module.exports.DramaDetailScreen as (props: { id: string }) => Node;

  function commit() {
    let iterations = 0;
    do {
      dirty = false;
      hook = 0;
      tree = Component({ id: 'drama-1' });
      for (let index = 0; index < effects.length; index += 1) {
        const current = effects[index];
        if (!current) continue;
        if (current.effect.toString() === '() => undefined') continue;
        current.cleanup?.();
        const cleanup = current.effect();
        current.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
        current.effect = () => undefined;
      }
      iterations += 1;
      assert.ok(iterations < 10, 'component effects did not settle');
    } while (dirty);
  }
  function nodes(root: unknown): Node[] {
    if (Array.isArray(root)) return root.flatMap(nodes);
    if (root === null || typeof root !== 'object') return [];
    const current = root as Node;
    if (!('type' in current) || !('props' in current)) return [];
    if (typeof current.type === 'function') return nodes((current.type as (props: Record<string, unknown>) => unknown)(current.props));
    return [current, ...nodes(current.props.children)];
  }
  function text(root: unknown): string {
    if (typeof root === 'string' || typeof root === 'number') return String(root);
    if (Array.isArray(root)) return root.map(text).join('');
    if (root === null || typeof root !== 'object') return '';
    return text((root as Node).props?.children);
  }
  function find(type: unknown, label?: string) {
    const found = nodes(tree).find((node) => node.type === type && (label === undefined || node.props.accessibilityLabel === label));
    assert.ok(found, `missing ${String(type)} ${label ?? ''}`);
    return found;
  }
  function findAllByText(type: unknown, value: string) {
    const found = nodes(tree).filter((node) => node.type === type && text(node.props.children) === value);
    assert.ok(found.length > 0, `missing ${String(type)} with text ${value}`);
    return found;
  }
  async function settle() { await new Promise<void>((resolve) => setImmediate(resolve)); commit(); }
  function load(requestIndex = requests.length - 1) { requests[requestIndex].resolve(drama); }
  return {
    commit, find, findAllByText, settle, load, requests, pushes,
    get visibleText() { return text(tree); },
    set user(value: { uuid: string } | null) { user = value; sessionVersion += 1; commit(); },
    set restoring(value: boolean) { isRestoring = value; commit(); },
    advanceSession() { sessionVersion += 1; commit(); },
    makeApiError(status: number, errorCode?: string) { return new ApiErrorMock(status, errorCode); },
    get dialogProps() { dialogProps = null; nodes(tree); return dialogProps as Record<string, unknown> | null; },
    unmount() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

const drama = {
  uuid: 'drama-1', slug: 'drama', title: '작품', shortDescription: '소개', synopsis: '소개', productionCompany: null,
  genres: [], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] }, previewVideos: [],
  episodes: [
    { uuid: 'free', episodeNumber: 1, title: null, synopsis: null, durationMs: 100, pricePoints: 0, isUnlocked: true, image: null, watchProgress: { positionMs: 0, isCompleted: false, lastPlayedAt: '2026-10-08T12:34:56.789Z' } },
    { uuid: 'owned', episodeNumber: 2, title: null, synopsis: null, durationMs: 100, pricePoints: 30, isUnlocked: true, image: null, watchProgress: null },
    { uuid: 'locked', episodeNumber: 3, title: null, synopsis: null, durationMs: 100, pricePoints: 50, isUnlocked: false, image: null, watchProgress: { positionMs: 10, isCompleted: true, lastPlayedAt: '2026-10-08T12:34:56.789Z' } },
    { uuid: 'locked-2', episodeNumber: 4, title: null, synopsis: null, durationMs: 100, pricePoints: 80, isUnlocked: false, image: null, watchProgress: null },
    { uuid: 'free-2', episodeNumber: 5, title: null, synopsis: null, durationMs: 100, pricePoints: 0, isUnlocked: true, image: null, watchProgress: null },
  ],
};

test('drama detail distinguishes free, purchased and locked episodes', async () => {
  const screen = createScreen();
  screen.user = { uuid: 'user-1' };
  assert.equal(screen.requests.at(-1)?.id, 'drama-1');
  screen.load();
  await screen.settle();

  const free = screen.find('Pressable', '1화 무료');
  const owned = screen.find('Pressable', '2화');
  const locked = screen.find('Pressable', '3화 50포인트');
  const locked2 = screen.find('Pressable', '4화 80포인트');
  const free2 = screen.find('Pressable', '5화 무료');
  const hasBackground = (node: Node, color: string) => (node.props.style as unknown[]).some(
    (style) => typeof style === 'object' && style !== null && (style as { backgroundColor?: string }).backgroundColor === color,
  );
  assert.equal(hasBackground(free, '#CBF46A18'), true);
  assert.equal(hasBackground(locked, '#CBF46A18'), true);
  assert.equal(hasBackground(owned, '#CBF46A18'), false);
  assert.equal(hasBackground(locked2, '#CBF46A18'), false);
  assert.equal(hasBackground(free2, '#CBF46A18'), false);
  assert.equal(hasBackground(owned, '#111'), true);
  assert.equal(hasBackground(free2, '#111'), true);
  const freeLabels = screen.findAllByText('AppText', '무료');
  assert.equal(freeLabels.length, 2);
  assert.equal((freeLabels[0].props.style as { color: string }).color, '#aaa');
  assert.equal((freeLabels[1].props.style as { color: string }).color, '#aaa');
  assert.match(screen.visibleText, /무료/);
  assert.match(screen.visibleText, /50P/);
  assert.doesNotMatch(screen.visibleText, /30P/);
  assert.equal(screen.find('EpisodeUnlockDialog').props.episode, null);
  (free.props.onPress as () => void)();
  (owned.props.onPress as () => void)();
  assert.equal(screen.pushes.length, 2);
  assert.equal((screen.pushes[0] as { params: { id: string } }).params.id, 'free');
  assert.equal(screen.pushes[1] && (screen.pushes[1] as { params: { id: string } }).params.id, 'owned');
  (locked.props.onPress as () => void)();
  screen.commit();
  assert.equal((screen.dialogProps?.episode as { uuid: string }).uuid, 'locked');
  screen.unmount();
});

test('drama detail reloads permissions on user changes and ignores stale responses', async () => {
  const screen = createScreen();
  screen.user = { uuid: 'user-a' };
  const staleIndex = screen.requests.length - 1;
  screen.user = { uuid: 'user-b' };
  const currentIndex = screen.requests.length - 1;
  assert.equal(screen.requests[currentIndex].id, 'drama-1');
  screen.load(staleIndex);
  await screen.settle();
  assert.equal(screen.find('EmptyState', undefined).props.title, '작품 정보를 불러오는 중이에요');
  screen.load(currentIndex);
  await screen.settle();
  (screen.find('Pressable', '3화 50포인트').props.onPress as () => void)();
  screen.commit();
  assert.equal((screen.dialogProps?.episode as { uuid: string }).uuid, 'locked');
  screen.user = null;
  assert.equal(screen.requests.at(-1)?.id, 'drama-1');
  assert.equal((screen.dialogProps?.episode as unknown) ?? null, null);
  screen.unmount();
});

test('purchased callback unlocks only that episode locally before navigating', async () => {
  const screen = createScreen();
  screen.user = { uuid: 'user-1' };
  screen.load();
  await screen.settle();
  const callback = screen.dialogProps?.onPurchased as (episode: typeof drama.episodes[number]) => void;
  callback(drama.episodes[2]);
  screen.commit();
  assert.equal(screen.find('Pressable', '3화').props.accessibilityLabel, '3화');
  assert.doesNotMatch(screen.visibleText, /50P/);
  assert.match(screen.visibleText, /80P/);
  assert.equal(screen.pushes.at(-1) && (screen.pushes.at(-1) as { params: { id: string } }).params.id, 'locked');
  (screen.find('Pressable', '3화').props.onPress as () => void)();
  screen.commit();
  assert.equal((screen.dialogProps?.episode as unknown) ?? null, null);
  assert.equal((screen.pushes.at(-1) as { params: { id: string } }).params.id, 'locked');
  screen.unmount();
});

test('detail waits for restore, shows 404 as not found, and retries other failures inline', async () => {
  const screen = createScreen();
  screen.restoring = true;
  assert.equal(screen.requests.length, 0);
  screen.restoring = false;
  assert.equal(screen.requests.length, 1);
  screen.requests[0].reject(screen.makeApiError(404, 'CONTENT_NOT_FOUND'));
  await screen.settle();
  assert.equal(screen.find('EmptyState').props.title, '작품을 찾을 수 없어요');
  screen.unmount();

  const offline = createScreen();
  offline.user = { uuid: 'user-a' };
  offline.requests[0].reject(new Error('network unavailable'));
  await offline.settle();
  const failed = offline.find('EmptyState');
  assert.equal(failed.props.action, '다시 시도');
  assert.match(String(failed.props.description), /요청을 처리하지 못했습니다/);
  (failed.props.onAction as () => void)();
  offline.commit();
  assert.equal(offline.requests.length, 2);
  offline.unmount();
});
