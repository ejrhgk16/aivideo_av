/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');
type Tree = { type: any; props: Record<string, any> };
type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function homeScreen(options: { user: { uuid: string } | null; hasPreview: boolean; isRestoring?: boolean; heroCount?: number }) {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/HomeScreen.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const hooks: any[] = [];
  let hook = 0;
  let focusCallback: (() => void | (() => void)) | null = null;
  let focusCleanup: (() => void) | undefined;
  let tree: Tree;
  const routes: unknown[] = [];
  const collections = new Map<string, Deferred<any>>();
  let catalog: Deferred<any>;
  const jsx = (type: any, props: Record<string, any>): Tree => ({ type, props });
  const react = {
    useState<T>(initial: T | (() => T)) {
      const index = hook++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? (initial as () => T)() : initial };
      return [hooks[index].value as T, (next: T | ((current: T) => T)) => { hooks[index].value = typeof next === 'function' ? (next as (current: T) => T)(hooks[index].value) : next; }] as const;
    },
    useMemo(factory: () => unknown, deps: unknown[]) {
      const index = hook++;
      if (!hooks[index] || deps.length !== hooks[index].deps.length || deps.some((value, i) => !Object.is(value, hooks[index].deps[i]))) hooks[index] = { value: factory(), deps };
      return hooks[index].value;
    },
    useCallback(callback: (...args: any[]) => any, deps: unknown[]) {
      const index = hook++;
      if (!hooks[index] || deps.length !== hooks[index].deps.length || deps.some((value, i) => !Object.is(value, hooks[index].deps[i]))) hooks[index] = { value: callback, deps };
      return hooks[index].value;
    },
  };
  const isCurrentSession = (version: number) => version === 1;
  const drama: any = {
    uuid: 'drama-hero', displayOrder: 1, slug: 'hero', title: 'Hero drama', shortDescription: 'Description',
    productionCompany: null, genres: [], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
    previewVideos: options.hasPreview ? [{ uuid: 'hero-preview', storageKey: '', durationMs: 60000, isSaved: false }] : [],
    publishedEpisodeCount: 1, freeEpisodeCount: 1,
  };
  const featured = options.heroCount === 2
    ? [drama, { ...drama, uuid: 'drama-next', displayOrder: 2, title: 'Next drama', previewVideos: [{ uuid: 'next-preview', storageKey: '', durationMs: 60000, isSaved: false }] }]
    : [drama];
  const modules: Record<string, any> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { PanResponder: { create: () => ({ panHandlers: {} }) }, Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (value: unknown) => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 390 }), View: 'View' },
    'expo-router': { useRouter: () => ({ push: (route: unknown) => routes.push(route) }), useFocusEffect(callback: () => void | (() => void)) { if (callback !== focusCallback) { focusCleanup?.(); focusCallback = callback; focusCleanup = callback() ?? undefined; } } },
    'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@/components/ui': { AppText: 'AppText', Button: 'Button', EmptyState: 'EmptyState', Icon: 'Icon', Page: 'Page', SectionTitle: 'SectionTitle' },
    '@/components/AppTopBar': { AppTopBar: 'AppTopBar' },
    '@/common/media': { resolveApiImageUrl: (value: string | null) => value },
    '@/common/theme/tokens': { colors: { accent: '#0f0', background: '#000', border: '#333', elevated: '#222', muted: '#aaa', surface: '#111', text: '#fff' } },
    '@/common/http/api': { ApiError: class ApiError extends Error { status = 401; }, SessionChangedError: class SessionChangedError extends Error {} },
    '@/features/home/homeContent': { getHomeCollection: (code: string) => { const request = deferred<any>(); collections.set(code, request); return request.promise; } },
    '@/features/drama/dramaContent': { getDramaList: () => { catalog = deferred<any>(); return catalog.promise; } },
    '@/features/user/UserProvider': { useUser: () => ({ isRestoring: options.isRestoring ?? false, sessionVersion: 1, isCurrentSession, user: options.user }) },
  };
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(output, { require: (id: string) => modules[id], module, exports: module.exports });
  const Screen = module.exports.HomeScreen as () => Tree;
  const render = () => { hook = 0; tree = Screen(); return tree; };
  const nodes = (node: any): Tree[] => !node || typeof node !== 'object' ? [] : [node as Tree, ...(Array.isArray(node.props?.children) ? node.props.children.flatMap(nodes) : nodes(node.props?.children))];
  return {
    render, nodes, get tree() { return tree; }, routes, collections,
    resolveCollection(code: string, value: any) { collections.get(code)!.resolve(value); },
    resolveCatalog() { catalog.resolve([]); },
    featured,
  };
}

function previewScreen() {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/playbackScreen_preview.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const values = new Map<string, unknown[]>();
  const refs = new Map<string, Array<{ current: any }>>();
  const callbacks = new Map<string, Array<{ callback: (...args: any[]) => any; deps: unknown[] }>>();
  let component = 'screen';
  let hook = 0;
  let focusCallback: (() => void | (() => void)) | null = null;
  let focusCleanup: (() => void) | undefined;
  let tree: Tree;
  let playerCount = 0;
  let activeSource: string | null = null;
  let sessionVersion = 1;
  const isCurrentSession = (version: number) => version === sessionVersion;
  const player = {
    currentTime: 0, duration: 60, playbackRate: 1, timeUpdateEventInterval: 0,
    playing: true, status: 'readyToPlay', playCalls: 0,
    play() { this.playCalls += 1; this.playing = true; }, pause() { this.playing = false; },
    addListener() { return { remove() {} }; },
  };
  const fetched: string[] = [];
  const savedWrites: unknown[][] = [];
  const writeTasks: Deferred<void>[] = [];
  const queuedDrama: Deferred<any>[] = [];
  let deferWrites = false;
  let currentVideoId = 'preview-exact';
  let currentUserUuid: string | null = 'user-1';
  let isRestoring = false;
  const pushes: unknown[] = [];
  let dramaRequest = 0;
  const effects = new Map<string, Array<{ deps?: unknown[]; cleanup?: () => void }>>();
  const jsx = (type: any, props: Record<string, any>): Tree => ({ type, props });
  const react = {
    useState<T>(initial: T | (() => T)) {
      const index = hook++;
      const bucket = values.get(component) ?? [];
      values.set(component, bucket);
      if (!(index in bucket)) bucket[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
      return [bucket[index] as T, (next: T | ((previous: T) => T)) => {
        bucket[index] = typeof next === 'function' ? (next as (previous: T) => T)(bucket[index] as T) : next;
      }] as const;
    },
    useRef<T>(initial: T) {
      const index = hook++;
      const bucket = refs.get(component) ?? [];
      refs.set(component, bucket);
      bucket[index] ??= { current: initial };
      return bucket[index] as { current: T };
    },
    useCallback<T extends (...args: any[]) => any>(callback: T, deps: unknown[] = []) {
      const index = hook++;
      const bucket = callbacks.get(component) ?? [];
      callbacks.set(component, bucket);
      const prior = bucket[index];
      if (prior && deps.length === prior.deps.length && deps.every((value, i) => Object.is(value, prior.deps[i]))) return prior.callback as T;
      bucket[index] = { callback, deps };
      return callback;
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = hook++;
      const bucket = effects.get(component) ?? [];
      effects.set(component, bucket);
      const previous = bucket[index];
      if (!previous || deps?.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        previous?.cleanup?.();
        const cleanup = effect();
        bucket[index] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
      }
    },
  };
  const fakePlayer = { ...player };
  const modules: Record<string, any> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', Pressable: 'Pressable', Share: { share() {} }, StyleSheet: { create: (value: unknown) => value, absoluteFill: {} }, View: 'View' },
    'expo-image': { Image: 'Image' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-router': {
      useRouter: () => ({ canGoBack: () => true, back() {}, replace() {}, push(route: unknown) { pushes.push(route); } }),
      useFocusEffect(callback: () => void | (() => void)) {
        if (component.startsWith('screen')) {
          if (callback !== focusCallback) { focusCleanup?.(); focusCallback = callback; focusCleanup = callback() ?? undefined; }
        } else callback();
      },
    },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: (url: string, initialize: (value: typeof player) => void) => { if (url !== activeSource) { activeSource = url; playerCount += 1; initialize(fakePlayer); } return fakePlayer; } },
    '@react-native-community/slider': 'Slider',
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/ui': { AppText: 'AppText', Button: 'Button', EmptyState: 'EmptyState', Icon: 'Icon', Page: 'Page' },
    '@/components/EpisodeUnlockDialog': { EpisodeUnlockDialog: 'EpisodeUnlockDialog' },
    '@/common/http/api': { ApiError: class ApiError extends Error { status = 401; }, SessionChangedError: class SessionChangedError extends Error {} },
    '@/common/http/errorMessages': { getErrorMessage: () => 'save failed' },
    '@/common/media': { resolveApiImageUrl: (value: string | null) => value },
    '@/common/theme/tokens': { colors: { accent: '#0f0', background: '#000', muted: '#aaa', text: '#fff', surface: '#111', border: '#333' } },
    '@/features/drama/dramaContent': { getDramaContent: async () => {
      dramaRequest += 1;
      const queued = queuedDrama.shift();
      if (queued) return queued.promise;
      return { uuid: 'drama-1', title: 'Drama', imageUrls: { poster: null }, genres: [], episodes: [], previewVideos: [{ uuid: 'another-preview', isSaved: false }, { uuid: 'preview-exact', isSaved: dramaRequest > 1 }] };
    } },
    '@/features/playback/previewPlayback': { getPreviewPlayback: async (_dramaId: string, videoId: string) => { fetched.push(videoId); return { url: `signed-${videoId}`, videoUuid: videoId, isSaved: videoId === 'preview-exact', durationMs: 60000 }; } },
    '@/features/playback/savedVideos': {
      saveVideo: (videoUuid: string, type: string) => { savedWrites.push([videoUuid, type, 'save']); if (!deferWrites) return Promise.resolve(); const task = deferred<void>(); writeTasks.push(task); return task.promise; },
      removeSavedVideo: (videoUuid: string) => { savedWrites.push([videoUuid, 'remove']); if (!deferWrites) return Promise.resolve(); const task = deferred<void>(); writeTasks.push(task); return task.promise; },
    },
    '@/features/user/UserProvider': { useUser: () => ({ isRestoring, sessionVersion, isCurrentSession, user: currentUserUuid === null ? null : { uuid: currentUserUuid }, sessionExpired: false }) },
  };
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(output, { require: (id: string) => modules[id], module, exports: module.exports, setTimeout: () => 1, clearTimeout() {} });
  const Screen = module.exports.PlaybackScreenPreview as (props: { dramaId: string; videoId: string }) => Tree;
  let renderedComponents = new Set<string>();
  function renderComponent(name: string, fn: () => Tree) {
    renderedComponents.add(name);
    const previousComponent = component;
    const previousHook = hook;
    component = name;
    hook = 0;
    const result = fn();
    component = previousComponent;
    hook = previousHook;
    return result;
  }
  function resolveTree(node: any): any {
    if (Array.isArray(node)) return node.map(resolveTree);
    if (!node || typeof node !== 'object' || !('type' in node)) return node;
    if (typeof node.type === 'function') return resolveTree(renderComponent(`${node.type.name}:${node.props.key ?? ''}`, () => node.type(node.props)));
    return { ...node, props: { ...node.props, children: resolveTree(node.props.children) } };
  }
  const render = () => {
    renderedComponents = new Set<string>();
    tree = resolveTree(renderComponent('screen', () => Screen({ dramaId: 'drama-1', videoId: currentVideoId })));
    for (const [name, bucket] of effects) {
      if (renderedComponents.has(name)) continue;
      bucket.forEach((entry) => entry?.cleanup?.());
      effects.delete(name); values.delete(name); refs.delete(name); callbacks.delete(name);
    }
    return tree;
  };
  const nodes = (node: any): Tree[] => !node || typeof node !== 'object' ? [] : [node as Tree, ...(Array.isArray(node.props?.children) ? node.props.children.flatMap(nodes) : nodes(node.props?.children))];
  return {
    render, nodes, get tree() { return tree; }, get playerCount() { return playerCount; }, player: fakePlayer, fetched, savedWrites,
    pushes,
    refocus() { focusCleanup?.(); focusCleanup = focusCallback?.() ?? undefined; },
    writeTasks,
    deferWrites() { deferWrites = true; },
    changeSession(uuid: string | null) { sessionVersion += 1; currentUserUuid = uuid; render(); },
    changeVideo(videoId: string) { currentVideoId = videoId; render(); },
    restoring(value: boolean) { isRestoring = value; render(); },
    queueDrama() { const task = deferred<any>(); queuedDrama.push(task); return task; },
    async settle() { await new Promise<void>((done) => setImmediate(done)); render(); render(); },
  };
}

test('preview save uses the exact selected route video and focus refresh keeps the active player and position', async () => {
  const screen = previewScreen();
  screen.render();
  await new Promise<void>((done) => setImmediate(done));
  screen.render();
  assert.deepEqual(screen.fetched, ['preview-exact']);
  assert.equal(screen.playerCount, 1);
  const save = screen.nodes(screen.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '저장 해제');
  assert.ok(save);
  assert.equal(save.props.accessibilityState.disabled, false);
  await (save.props.onPress as () => Promise<void>)();
  await screen.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(screen.savedWrites)), [['preview-exact', 'remove']]);
  assert.ok(screen.nodes(screen.tree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장'),
    'a successful remove updates both the player and parent playback state');

  screen.player.currentTime = 23;
  screen.refocus();
  await new Promise<void>((done) => setImmediate(done));
  screen.render();
  screen.render();
  assert.equal(screen.fetched.length, 1, 'focus refresh reads saved metadata without fetching another signed playback URL');
  assert.equal(screen.playerCount, 1, 'metadata refresh preserves the VideoPlayer instance');
  assert.equal(screen.player.currentTime, 23, 'metadata refresh preserves playback position');
  assert.ok(screen.nodes(screen.tree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '저장 해제'),
    'fresh server metadata changes the button back to saved without remounting playback');
});

test('preview bookmark save and removal keep a user-paused player paused', async () => {
  const screen = previewScreen(); screen.deferWrites(); screen.render(); await screen.settle();
  const paused = screen.nodes(screen.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '일시정지');
  assert.ok(paused);
  (paused.props.onPress as () => void)();
  assert.equal(screen.player.playing, false);
  const playCount = screen.player.playCalls;
  const playerCount = screen.playerCount;
  screen.player.currentTime = 19;

  const remove = screen.nodes(screen.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '저장 해제')!;
  const removeTask = (remove.props.onPress as () => Promise<void>)(); screen.render();
  assert.equal(screen.nodes(screen.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '저장 해제')?.props.accessibilityState.busy, true);
  assert.equal(screen.player.playing, false);
  screen.writeTasks[0].resolve(); await removeTask; await screen.settle();
  assert.equal(screen.player.playing, false);
  assert.equal(screen.player.playCalls, playCount);
  assert.equal(screen.playerCount, playerCount);
  assert.equal(screen.player.currentTime, 19);

  const save = screen.nodes(screen.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장')!;
  const saveTask = (save.props.onPress as () => Promise<void>)(); screen.render();
  assert.equal(screen.player.playing, false);
  screen.writeTasks[1].resolve(); await saveTask; await screen.settle();
  assert.equal(screen.player.playing, false);
  assert.equal(screen.player.playCalls, playCount);
  assert.equal(screen.playerCount, playerCount);
  assert.equal(screen.player.currentTime, 19);
});

test('preview save locks duplicate taps, preserves state on failure, and permits retry', async () => {
  const screen = previewScreen(); screen.deferWrites(); screen.render(); await screen.settle();
  const remove = () => screen.nodes(screen.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '저장 해제')!;
  const first = remove();
  (first.props.onPress as () => void)(); (first.props.onPress as () => void)();
  assert.equal(screen.savedWrites.length, 1, 'same-frame taps issue one API write');
  screen.render();
  assert.equal(remove().props.accessibilityState.busy, true);
  screen.writeTasks[0].reject(new Error('offline')); await screen.settle();
  assert.equal(remove().props.accessibilityLabel, '저장 해제', 'failed writes preserve the saved state');
  assert.ok(screen.nodes(screen.tree).some((node) => node.props.accessibilityRole === 'alert'));
  (remove().props.onPress as () => void)();
  assert.equal(screen.savedWrites.length, 2, 'failure releases the lock for retry');
  screen.writeTasks[1].resolve(); await screen.settle();
  assert.ok(screen.nodes(screen.tree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장'));
});

test('preview requires login for anonymous writes, disables during restoration, and ignores late writes after route or account change', async () => {
  const anonymous = previewScreen(); anonymous.changeSession(null); await anonymous.settle();
  (anonymous.nodes(anonymous.tree).find((node) => node.props.accessibilityLabel === '저장 해제')!.props.onPress as () => void)();
  assert.deepEqual(anonymous.savedWrites, []);
  assert.deepEqual(anonymous.pushes, ['/login']);
  anonymous.restoring(true);
  assert.equal(anonymous.nodes(anonymous.tree).some((node) => node.props.accessibilityLabel === '저장 해제'), false,
    'restoring keeps playback controls unavailable until the session is known');

  const routeChange = previewScreen(); routeChange.deferWrites(); routeChange.render(); await routeChange.settle();
  (routeChange.nodes(routeChange.tree).find((node) => node.props.accessibilityLabel === '저장 해제')!.props.onPress as () => void)();
  routeChange.changeVideo('preview-next'); await routeChange.settle();
  routeChange.writeTasks[0].resolve(); await routeChange.settle();
  assert.ok(routeChange.nodes(routeChange.tree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장'),
    'the old preview write cannot change the new route button');

  const accountChange = previewScreen(); accountChange.deferWrites(); accountChange.render(); await accountChange.settle();
  (accountChange.nodes(accountChange.tree).find((node) => node.props.accessibilityLabel === '저장 해제')!.props.onPress as () => void)();
  accountChange.changeSession('user-2'); await accountChange.settle();
  accountChange.writeTasks[0].resolve(); await accountChange.settle();
  assert.ok(accountChange.nodes(accountChange.tree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '저장 해제'),
    'the old account write cannot replace the new account server flag');
});

test('home hero opens the current first preview directly without saved-video writes', async () => {
  const member = homeScreen({ user: { uuid: 'user-1' }, hasPreview: true });
  member.render();
  const hero = { uuid: 'drama-hero', displayOrder: 1, slug: 'hero', title: 'Hero drama', shortDescription: 'Description', productionCompany: null, genres: [], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] }, previewVideos: [{ uuid: 'hero-preview', storageKey: '', durationMs: 60000, isSaved: false }], publishedEpisodeCount: 1, freeEpisodeCount: 1 };
  member.resolveCollection('HOME_FEATURED', { dramas: [hero] });
  await new Promise<void>((done) => setImmediate(done));
  member.render();
  const previewButton = () => member.nodes(member.tree).find((node) => node.type === 'Button' && node.props.label === '분위기 미리보기');
  assert.ok(previewButton());
  assert.equal(previewButton()?.props.disabled, false);
  (previewButton()?.props.onPress as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(member.routes)), [{ pathname: '/preview/[dramaId]/[videoId]', params: { dramaId: 'drama-hero', videoId: 'hero-preview' } }]);

  const anonymous = homeScreen({ user: null, hasPreview: true });
  anonymous.render();
  anonymous.resolveCollection('HOME_FEATURED', { dramas: [hero] });
  await new Promise<void>((done) => setImmediate(done));
  anonymous.render();
  const anonymousPreview = anonymous.nodes(anonymous.tree).find((node) => node.type === 'Button' && node.props.label === '분위기 미리보기');
  assert.ok(anonymousPreview);
  (anonymousPreview.props.onPress as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(anonymous.routes)), [{ pathname: '/preview/[dramaId]/[videoId]', params: { dramaId: 'drama-hero', videoId: 'hero-preview' } }]);

  const withoutPreview = homeScreen({ user: { uuid: 'user-1' }, hasPreview: false });
  withoutPreview.render();
  withoutPreview.resolveCollection('HOME_FEATURED', { dramas: [{ ...hero, previewVideos: [] }] });
  await new Promise<void>((done) => setImmediate(done));
  withoutPreview.render();
  const disabledPreview = withoutPreview.nodes(withoutPreview.tree).find((node) => node.type === 'Button' && node.props.label === '분위기 미리보기');
  assert.ok(disabledPreview);
  assert.equal(disabledPreview.props.disabled, true, 'a hero without a preview cannot open playback');
  (disabledPreview.props.onPress as () => void)();
  assert.deepEqual(withoutPreview.routes, []);

  const changingHero = homeScreen({ user: { uuid: 'user-1' }, hasPreview: true, heroCount: 2 });
  changingHero.render();
  changingHero.resolveCollection('HOME_FEATURED', { dramas: changingHero.featured });
  await new Promise<void>((done) => setImmediate(done));
  changingHero.render();
  const nextHero = changingHero.nodes(changingHero.tree).find((node) => node.props.accessibilityLabel === 'Next drama 추천 보기');
  assert.ok(nextHero);
  (nextHero.props.onPress as () => void)();
  changingHero.render();
  const nextPreviewButton = changingHero.nodes(changingHero.tree).find((node) => node.type === 'Button' && node.props.label === '분위기 미리보기');
  (nextPreviewButton?.props.onPress as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(changingHero.routes)), [{ pathname: '/preview/[dramaId]/[videoId]', params: { dramaId: 'drama-next', videoId: 'next-preview' } }]);

  const restoring = homeScreen({ user: { uuid: 'user-1' }, hasPreview: true, isRestoring: true });
  restoring.render();
  assert.equal(restoring.collections.size, 0, 'a restoring session does not load a per-user featured collection');
  assert.equal(restoring.nodes(restoring.tree).some((node) => node.type === 'Button' && node.props.label === '분위기 미리보기'), false);
});
