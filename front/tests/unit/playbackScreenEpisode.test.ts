import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');
type Node = { type: unknown; props: Record<string, unknown> };

function createScreen(dramaId = 'drama-1') {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/playbackScreen_episode.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const state: unknown[] = [];
  const effects: { effect: () => void | (() => void); deps?: unknown[]; cleanup?: () => void }[] = [];
  let hook = 0;
  let tree: Node | null = null;
  let dirty = false;
  let isRestoring = false;
  let sessionVersion = 0;
  const requests: { resolve: (value: unknown) => void; reject: (error: unknown) => void }[] = [];
  const pushes: unknown[] = [];
  const replaces: unknown[] = [];
  class ApiErrorMock extends Error {
    constructor(public status: number, public errorCode: string | null = null) { super(errorCode ?? `HTTP_${status}`); }
  }
  const isCurrentSession = (version: number) => version === sessionVersion;
  const jsx = (type: unknown, props: Record<string, unknown>): Node => ({ type, props });
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
      if (!prior || deps?.some((value, position) => !Object.is(value, prior.deps?.[position]))) effects[index] = { effect, deps, cleanup: prior?.cleanup };
    },
  };
  const passthrough = (type: string) => (props: Record<string, unknown>) => jsx(type, props);
  const modules: Record<string, unknown> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', Pressable: 'Pressable', Share: { share() {} }, StyleSheet: { create: (value: unknown) => value, absoluteFill: {} }, View: 'View' },
    'expo-router': { useFocusEffect() {}, useRouter: () => ({ canGoBack: () => true, back() {}, replace: (route: unknown) => replaces.push(route), push: (route: unknown) => pushes.push(route) }) },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: () => ({}) },
    '@react-native-community/slider': 'Slider',
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/ui': { AppText: passthrough('AppText'), Button: passthrough('Button'), EmptyState: passthrough('EmptyState'), Icon: passthrough('Icon'), Page: passthrough('Page') },
    '@/components/EpisodeUnlockDialog': { EpisodeUnlockDialog: passthrough('EpisodeUnlockDialog') },
    '@/common/http/api': { ApiError: ApiErrorMock, SessionChangedError: class SessionChangedError extends Error {} },
    '@/common/http/errorMessages': { getErrorMessage: () => '연결을 확인한 뒤 다시 시도해 주세요.' },
    '@/common/theme/tokens': { colors: { muted: '#aaa', accent: '#0f0', text: '#fff', surface: '#111', border: '#333' } },
    '@/features/drama/dramaContent': { getDramaContent: async () => ({ episodes: [] }) },
    '@/features/playback/episodePlayback': { getEpisodePlayback: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
    '@/features/user/UserProvider': { useUser: () => ({ isRestoring, sessionVersion, isCurrentSession, sessionExpired: false, user: null }) },
  };
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(compiled, { exports: module.exports, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected module: ${id}`);
    return modules[id];
  } }, { filename: 'PlaybackScreenEpisode.js' });
  const Component = module.exports.PlaybackScreenEpisode as (props: { id: string; dramaId?: string }) => Node;

  function commit() {
    let iterations = 0;
    do {
      dirty = false;
      hook = 0;
      tree = Component({ id: 'episode-1', dramaId });
      for (const current of effects) {
        if (!current) continue;
        if (current.effect.toString() === '() => undefined') continue;
        current.cleanup?.();
        const cleanup = current.effect();
        current.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
        current.effect = () => undefined;
      }
      iterations += 1;
      assert.ok(iterations < 10, 'screen effects did not settle');
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
  function find(type: string) {
    const node = nodes(tree).find((entry) => entry.type === type);
    assert.ok(node, `missing ${type}`);
    return node;
  }
  async function settle() { await new Promise<void>((resolve) => setImmediate(resolve)); commit(); }
  return {
    commit, find, requests, pushes, replaces, makeApiError: (status: number, code?: string) => new ApiErrorMock(status, code), settle,
    set restoring(value: boolean) { isRestoring = value; commit(); },
    unmount() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

test('playback waits for restore and an anonymous paid episode offers an explicit login route', async () => {
  const screen = createScreen();
  screen.restoring = true;
  assert.equal(screen.requests.length, 0);
  screen.restoring = false;
  assert.equal(screen.requests.length, 1);
  screen.requests[0].reject(screen.makeApiError(401, 'AUTH_INVALID_TOKEN'));
  await screen.settle();
  assert.equal(screen.find('EmptyState').props.title, '로그인이 필요해요');
  assert.equal(screen.find('EmptyState').props.action, '로그인');
  (screen.find('EmptyState').props.onAction as () => void)();
  assert.deepEqual(screen.pushes, ['/login']);
  screen.unmount();
});

test('playback keeps paid access denied separate from missing media and offers a retry for network failures', async () => {
  const screen = createScreen();
  screen.commit();
  screen.requests[0].reject(screen.makeApiError(403, 'EPISODE_ACCESS_DENIED'));
  await screen.settle();
  assert.equal(screen.find('EmptyState').props.title, '구매 후 재생할 수 있어요');
  assert.equal(screen.find('EmptyState').props.action, '회차 보기');
  (screen.find('EmptyState').props.onAction as () => void)();
  assert.equal(JSON.stringify(screen.replaces), JSON.stringify([{ pathname: '/drama/[id]', params: { id: 'drama-1', tab: 'episodes' } }]));

  const missing = createScreen();
  missing.commit();
  missing.requests[0].reject(missing.makeApiError(404, 'CONTENT_NOT_FOUND'));
  await missing.settle();
  assert.equal(missing.find('EmptyState').props.title, '재생할 영상을 찾을 수 없어요');

  const offline = createScreen();
  offline.commit();
  offline.requests[0].reject(new Error('offline'));
  await offline.settle();
  assert.equal(offline.find('EmptyState').props.action, '다시 시도');
  (offline.find('EmptyState').props.onAction as () => void)();
  offline.commit();
  assert.equal(offline.requests.length, 2);
  missing.unmount();
  screen.unmount();
  offline.unmount();
});
