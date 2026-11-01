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

function homeScreen(options: { user: { uuid: string } | null; hasPreview: boolean }) {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/HomeScreen.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const hooks: any[] = [];
  let hook = 0;
  let focusCallback: (() => void | (() => void)) | null = null;
  let focusCleanup: (() => void) | undefined;
  let tree: Tree;
  let writePending: Deferred<void> | null = null;
  let writeError: unknown = null;
  const writes: unknown[][] = [];
  const routes: unknown[] = [];
  const collections = new Map<string, Deferred<any>>();
  let catalog: Deferred<any>;
  let snapshot: { videos: Record<string, { isSaved: boolean; pending: boolean }>; revision: number } = { videos: {}, revision: 0 };
  const state = {
    getSnapshot: () => snapshot,
    accept(rows: Array<{ videoUuid: string; isSaved: boolean }>, revision: number) {
      if (revision !== snapshot.revision) return false;
      const videos = { ...snapshot.videos };
      for (const row of rows) if (!videos[row.videoUuid]?.pending) videos[row.videoUuid] = { isSaved: row.isSaved, pending: false };
      snapshot = { videos, revision: snapshot.revision };
      return true;
    },
  };
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
  const drama = {
    uuid: 'drama-hero', displayOrder: 1, slug: 'hero', title: 'Hero drama', shortDescription: 'Description',
    productionCompany: null, genres: [], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
    previewVideos: options.hasPreview ? [{ uuid: 'hero-preview', storageKey: '', durationMs: 60000, isSaved: false }] : [],
    publishedEpisodeCount: 1, freeEpisodeCount: 1,
  };
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
    '@/common/http/errorMessages': { getErrorMessage: () => 'save failed' },
    '@/features/home/homeContent': { getHomeCollection: (code: string) => { const request = deferred<any>(); collections.set(code, request); return request.promise; } },
    '@/features/drama/dramaContent': { getDramaList: () => { catalog = deferred<any>(); return catalog.promise; } },
    '@/features/user/UserProvider': { useUser: () => ({ isRestoring: false, sessionVersion: 1, isCurrentSession, sessionExpired: false, user: options.user }) },
    '@/features/playback/SavedVideosProvider': {
      useSavedVideos: () => ({ state, snapshot }),
      useSavedVideo: (videoUuid: string | null, contentType: string, initialSaved: boolean) => {
        const entry = videoUuid === null ? undefined : snapshot.videos[videoUuid];
        return {
          saved: entry?.isSaved ?? initialSaved,
          pending: entry?.pending ?? false,
          toggle: () => {
            if (videoUuid === null) return Promise.resolve(false);
            const current = snapshot.videos[videoUuid] ?? { isSaved: initialSaved, pending: false };
            if (current.pending) return Promise.resolve(false);
            const next = !current.isSaved;
            snapshot = { ...snapshot, videos: { ...snapshot.videos, [videoUuid]: { ...current, pending: true } } };
            writes.push([videoUuid, contentType, next]);
            writePending = deferred<void>();
            const task = writePending;
            const fail = writeError;
            writeError = null;
            return task.promise.then(() => { if (fail) throw fail; snapshot = { ...snapshot, videos: { ...snapshot.videos, [videoUuid]: { isSaved: next, pending: false } }, revision: snapshot.revision + 1 }; }).catch((error) => { snapshot = { ...snapshot, videos: { ...snapshot.videos, [videoUuid]: { isSaved: current.isSaved, pending: false } } }; throw error; });
          },
        };
      },
    },
  };
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(output, { require: (id: string) => modules[id], module, exports: module.exports });
  const Screen = module.exports.HomeScreen as () => Tree;
  const render = () => { hook = 0; tree = Screen(); return tree; };
  const nodes = (node: any): Tree[] => !node || typeof node !== 'object' ? [] : [node as Tree, ...(Array.isArray(node.props?.children) ? node.props.children.flatMap(nodes) : nodes(node.props?.children))];
  return {
    render, nodes, get tree() { return tree; }, writes, routes, collections, get writePending() { return writePending; },
    resolveCollection(code: string, value: any) { collections.get(code)!.resolve(value); },
    resolveCatalog() { catalog.resolve([]); },
    failNextWrite(error: unknown) { writeError = error; },
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
    playing: true, status: 'readyToPlay',
    play() { this.playing = true; }, pause() { this.playing = false; },
    addListener() { return { remove() {} }; },
  };
  const fetched: string[] = [];
  const accepted: unknown[] = [];
  const toggled: unknown[][] = [];
  let dramaRequest = 0;
  const savedState = { getSnapshot: () => ({ revision: 0 }), accept: (rows: unknown[]) => { accepted.push(rows); return true; } };
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
    useEffect() { hook += 1; },
  };
  const fakePlayer = { ...player };
  const modules: Record<string, any> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', Pressable: 'Pressable', Share: { share() {} }, StyleSheet: { create: (value: unknown) => value, absoluteFill: {} }, View: 'View' },
    'expo-image': { Image: 'Image' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-router': {
      useRouter: () => ({ canGoBack: () => true, back() {}, replace() {}, push() {} }),
      useFocusEffect(callback: () => void | (() => void)) {
        if (component === 'screen') {
          if (callback !== focusCallback) { focusCleanup?.(); focusCallback = callback; focusCleanup = callback() ?? undefined; }
        } else callback();
      },
    },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: (url: string, initialize: (value: typeof player) => void) => { if (url !== activeSource) { activeSource = url; playerCount += 1; } initialize(fakePlayer); return fakePlayer; } },
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
      return { uuid: 'drama-1', title: 'Drama', imageUrls: { poster: null }, genres: [], episodes: [], previewVideos: [{ uuid: 'another-preview', isSaved: false }, { uuid: 'preview-exact', isSaved: dramaRequest > 1 }] };
    } },
    '@/features/playback/previewPlayback': { getPreviewPlayback: async (_dramaId: string, videoId: string) => { fetched.push(videoId); return { url: 'signed-url', videoUuid: videoId, isSaved: true, durationMs: 60000 }; } },
    '@/features/playback/SavedVideosProvider': {
      useSavedVideo: (videoUuid: string, type: string, initialSaved: boolean) => ({ saved: initialSaved, pending: false, toggle: async () => { toggled.push([videoUuid, type, initialSaved]); return true; } }),
      useSavedVideos: () => ({ state: savedState, snapshot: { videos: {}, revision: 0 } }),
    },
    '@/features/user/UserProvider': { useUser: () => ({ isRestoring: false, sessionVersion, isCurrentSession, user: { uuid: 'user-1' }, sessionExpired: false }) },
  };
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(output, { require: (id: string) => modules[id], module, exports: module.exports, setTimeout: () => 1, clearTimeout() {} });
  const Screen = module.exports.PlaybackScreenPreview as (props: { dramaId: string; videoId: string }) => Tree;
  function renderComponent(name: string, fn: () => Tree) {
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
    if (typeof node.type === 'function') return resolveTree(renderComponent(node.type.name, () => node.type(node.props)));
    return { ...node, props: { ...node.props, children: resolveTree(node.props.children) } };
  }
  const render = () => { tree = resolveTree(renderComponent('screen', () => Screen({ dramaId: 'drama-1', videoId: 'preview-exact' }))); return tree; };
  const nodes = (node: any): Tree[] => !node || typeof node !== 'object' ? [] : [node as Tree, ...(Array.isArray(node.props?.children) ? node.props.children.flatMap(nodes) : nodes(node.props?.children))];
  return {
    render, nodes, get tree() { return tree; }, get playerCount() { return playerCount; }, player: fakePlayer, fetched, accepted, toggled,
    refocus() { focusCleanup?.(); focusCleanup = focusCallback?.() ?? undefined; },
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
  assert.deepEqual(JSON.parse(JSON.stringify(screen.toggled)), [['preview-exact', 'PREVIEW', true]]);

  screen.player.currentTime = 23;
  screen.refocus();
  await new Promise<void>((done) => setImmediate(done));
  screen.render();
  assert.equal(screen.fetched.length, 1, 'focus refresh reads saved metadata without fetching another signed playback URL');
  assert.equal(screen.playerCount, 1, 'metadata refresh preserves the VideoPlayer instance');
  assert.equal(screen.player.currentTime, 23, 'metadata refresh preserves playback position');
  assert.ok(screen.accepted.some((rows: any) => rows.some((row: any) => row.videoUuid === 'preview-exact' && row.isSaved)));
});

test('home hero saves and unsaves its first preview, shows pending and error states, and handles anonymous or missing previews', async () => {
  const member = homeScreen({ user: { uuid: 'user-1' }, hasPreview: true });
  member.render();
  const hero = { uuid: 'drama-hero', displayOrder: 1, slug: 'hero', title: 'Hero drama', shortDescription: 'Description', productionCompany: null, genres: [], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] }, previewVideos: [{ uuid: 'hero-preview', storageKey: '', durationMs: 60000, isSaved: false }], publishedEpisodeCount: 1, freeEpisodeCount: 1 };
  member.resolveCollection('HOME_FEATURED', { dramas: [hero] });
  await new Promise<void>((done) => setImmediate(done));
  member.render();
  const save = () => member.nodes(member.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityRole === 'button' && ['작품 저장', '저장 해제'].includes(node.props.accessibilityLabel));
  const firstSave = save();
  assert.ok(firstSave);
  assert.equal(firstSave.props.accessibilityLabel, '작품 저장');
  assert.equal(firstSave.props.accessibilityState.disabled, false);
  (firstSave.props.onPress as () => void)();
  member.render();
  assert.equal(save()?.props.accessibilityState.busy, true, 'the hero action disables while the shared write is pending');
  member.writePending!.resolve();
  await new Promise<void>((done) => setImmediate(done));
  member.render();
  assert.equal(save()?.props.accessibilityLabel, '저장 해제');
  (save()!.props.onPress as () => void)();
  member.writePending!.resolve();
  await new Promise<void>((done) => setImmediate(done));
  member.render();
  assert.deepEqual(JSON.parse(JSON.stringify(member.writes)), [['hero-preview', 'PREVIEW', true], ['hero-preview', 'PREVIEW', false]]);
  assert.equal(save()?.props.accessibilityLabel, '작품 저장');

  member.failNextWrite(new Error('offline'));
  (save()!.props.onPress as () => void)();
  member.writePending!.resolve();
  await new Promise<void>((done) => setImmediate(done));
  member.render();
  assert.ok(member.nodes(member.tree).some((node) => node.type === 'AppText' && node.props.accessibilityRole === 'alert'));

  const anonymous = homeScreen({ user: null, hasPreview: true });
  anonymous.render();
  anonymous.resolveCollection('HOME_FEATURED', { dramas: [hero] });
  await new Promise<void>((done) => setImmediate(done));
  anonymous.render();
  const anonymousSave = anonymous.nodes(anonymous.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장');
  assert.ok(anonymousSave);
  (anonymousSave.props.onPress as () => void)();
  assert.deepEqual(anonymous.routes, ['/login']);
  assert.equal(anonymous.writes.length, 0, 'anonymous save never reaches the write API');

  const withoutPreview = homeScreen({ user: { uuid: 'user-1' }, hasPreview: false });
  withoutPreview.render();
  withoutPreview.resolveCollection('HOME_FEATURED', { dramas: [{ ...hero, previewVideos: [] }] });
  await new Promise<void>((done) => setImmediate(done));
  withoutPreview.render();
  const disabledSave = withoutPreview.nodes(withoutPreview.tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장');
  assert.ok(disabledSave);
  assert.equal(disabledSave.props.accessibilityState.disabled, true, 'a hero without a preview cannot be saved');
  assert.equal(withoutPreview.writes.length, 0);
});
