/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ts = require(resolve(process.cwd(), 'node_modules/typescript')) as typeof import('typescript');
type Tree = { type: unknown; props: Record<string, any> };
type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(initialTab = 'saved') {
  const requests: Deferred<any>[] = [];
  const requestPages: number[] = [];
  const historyRequests: Deferred<any>[] = [];
  const historyRequestPages: number[] = [];
  const routes: unknown[] = [];
  let user: { uuid: string } | null = null;
  let isRestoring = true;
  let sessionVersion = 0;
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
    'expo-image': { Image: 'Image' },
    'expo-router': {
      useLocalSearchParams: () => ({ tab: initialTab }),
      useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
      useFocusEffect(callback: () => void | (() => void)) {
        if (focusCallback !== callback) { focusDirty = true; focusCallback = callback; }
      },
    },
    '@/components/ui': { AppText: passthrough('AppText'), Button: passthrough('Button'), EmptyState: passthrough('EmptyState'), Page: passthrough('Page'), SectionTitle: passthrough('SectionTitle') },
    '@/components/AppTopBar': { AppTopBar: 'AppTopBar' },
    '@/common/theme/tokens': { colors: { surface: '#111', elevated: '#222', muted: '#aaa', text: '#fff' } },
    '@/common/http/errorMessages': { getErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'unknown' },
    '@/features/playback/savedVideos': { getSavedVideos: (page = 1) => { const request = deferred<any>(); requests.push(request); requestPages.push(page); return request.promise; }, savedVideoRoute: (item: any) => item.contentType === 'EPISODE' ? { pathname: '/episode/[id]', params: { id: item.episodeUuid, dramaId: item.dramaUuid } } : { pathname: '/preview/[dramaId]/[videoId]', params: { dramaId: item.dramaUuid, videoId: item.videoUuid } } },
    '@/features/playback/watchHistory': { getWatchHistory: (page = 1) => { const request = deferred<any>(); historyRequests.push(request); historyRequestPages.push(page); return request.promise; } },
    '@/features/user/UserProvider': { useUser: () => ({ isRestoring, user, sessionVersion, isCurrentSession }) },
    '@/common/media': { resolveApiImageUrl: (url: string) => url },
  };
  const source = readFileSync(resolve(process.cwd(), 'src/screens/LibraryScreen.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(output, { require: (id: string) => modules[id], module, exports: module.exports });
  const Screen = module.exports.LibraryScreen as () => Tree;

  function render() {
    hook = 0;
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
    dirty = false;
    return tree;
  }
  function refocus() {
    focusCleanup?.();
    focusCleanup = focusCallback?.() ?? undefined;
  }
  async function settle() {
    await new Promise<void>((done) => setImmediate(done));
    if (dirty) render();
    await new Promise<void>((done) => setImmediate(done));
    if (dirty) render();
  }
  function find(node: any, type: string): Tree[] {
    if (!node || typeof node !== 'object') return [];
    const found = node.type === type ? [node as Tree] : [];
    const children = node.props?.children;
    return found.concat(Array.isArray(children) ? children.flatMap((child: any) => find(child, type)) : find(children, type));
  }
  return {
    requests, requestPages, historyRequests, historyRequestPages, routes, render, settle, find, refocus, get tree() { return tree; },
    setSession(nextUser: { uuid: string } | null, restoring: boolean, version: number) { user = nextUser; isRestoring = restoring; sessionVersion = version; },
  };
}

const page = (items: any[], hasNext = false) => ({ items, page: 1, hasNext });
const preview = { videoUuid: 'preview-1', savedAt: 'now', dramaUuid: 'drama-1', dramaTitle: '작품 하나', imageUrl: null, durationMs: 60000, contentType: 'PREVIEW', episodeUuid: null, episodeNumber: null, episodeTitle: null };
const episode = { videoUuid: 'episode-video-1', savedAt: 'now', dramaUuid: 'drama-2', dramaTitle: '작품 둘', imageUrl: '/cover.jpg', durationMs: 125000, contentType: 'EPISODE', episodeUuid: 'episode-1', episodeNumber: 2, episodeTitle: '두 번째' };
const historyPreview = { ...preview, savedAt: undefined, lastPlayedAt: '2026-11-03T00:00:00.000Z' };
const historyEpisode = { ...episode, savedAt: undefined, lastPlayedAt: '2026-11-02T00:00:00.000Z' };

test('saved library waits for restored session, loads saved cards, and routes preview and episode records', async () => {
  const screen = setup();
  screen.render();
  assert.equal(screen.requests.length, 0);
  screen.setSession({ uuid: 'account-a' }, false, 1);
  screen.render();
  assert.equal(screen.requests.length, 1);
  screen.requests[0].resolve(page([preview, episode]));
  await screen.settle();
  const list = screen.find(screen.tree, 'FlatList')[0];
  assert.equal(list.props.data.length, 2);
  list.props.renderItem({ item: preview }).props.onPress();
  list.props.renderItem({ item: episode }).props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(screen.routes)), [
    { pathname: '/preview/[dramaId]/[videoId]', params: { dramaId: 'drama-1', videoId: 'preview-1' } },
    { pathname: '/episode/[id]', params: { id: 'episode-1', dramaId: 'drama-2' } },
  ]);
});

test('saved cards show drama, video kind, TOP3 image size, and accurate short durations', async () => {
  const screen = setup();
  screen.setSession({ uuid: 'account-a' }, false, 1);
  screen.render();
  const items = [
    { ...preview, videoUuid: 'preview-15s', durationMs: 15000, dramaTitle: '짧은 프리뷰' },
    { ...preview, videoUuid: 'preview-60s', durationMs: 60000 },
    { ...preview, videoUuid: 'preview-90s', durationMs: 90000 },
    { ...preview, videoUuid: 'preview-120s', durationMs: 120000 },
    { ...episode, durationMs: 125000 },
    { ...preview, videoUuid: 'preview-subsecond', durationMs: 1 },
  ];
  screen.requests[0].resolve(page(items));
  await screen.settle();

  const list = screen.find(screen.tree, 'FlatList')[0];
  const expectedDurations = ['15초', '1분', '1분 30초', '2분', '2분 5초', '1초'];
  items.forEach((item, index) => {
    const card = list.props.renderItem({ item });
    const labels = screen.find(card, 'AppText').map((node) => node.props.children);
    assert.deepEqual(labels, [
      item.dramaTitle,
      item.contentType === 'PREVIEW' ? '미리보기' : '에피소드 2화',
      expectedDurations[index],
    ]);
    assert.equal(card.props.accessibilityLabel, `${item.dramaTitle} ${item.contentType === 'PREVIEW' ? '미리보기' : '에피소드 2화'}`);
    if (item.contentType === 'EPISODE') assert.equal(labels.includes(item.episodeTitle ?? ''), false);
  });

  const episodeCard = list.props.renderItem({ item: items[4] });
  const image = screen.find(episodeCard, 'Image')[0];
  assert.equal(image.props.contentFit, 'cover');
  assert.deepEqual(JSON.parse(JSON.stringify(image.props.style)), {
    width: 112, height: 63, borderRadius: 7, borderCurve: 'continuous', backgroundColor: '#222',
  });
  const placeholderCard = list.props.renderItem({ item: items[0] });
  assert.deepEqual(screen.find(placeholderCard, 'Image'), []);
  const placeholder = screen.find(placeholderCard, 'View').find((node) => Array.isArray(node.props.style));
  assert.ok(placeholder);
  assert.deepEqual(JSON.parse(JSON.stringify(placeholder.props.style[0])), JSON.parse(JSON.stringify(image.props.style)));
});

test('saved library keeps load errors distinct from an empty list and refetches on account change', async () => {
  const screen = setup();
  screen.setSession({ uuid: 'account-a' }, false, 1);
  screen.render();
  const failed = screen.requests[0];
  failed.reject(new Error('offline'));
  await screen.settle();
  assert.equal(screen.find(screen.tree, 'EmptyState')[0]?.props.title, '저장한 영상을 불러오지 못했어요');
  const retry = screen.find(screen.tree, 'EmptyState')[0]?.props.onAction as (() => void);
  retry();
  screen.render();
  assert.equal(screen.requests.length, 2);
  screen.requests[1].resolve(page([preview]));
  await screen.settle();
  screen.setSession({ uuid: 'account-b' }, false, 2);
  screen.render();
  assert.equal(screen.find(screen.tree, 'FlatList').length, 0, 'the prior account list is hidden before the replacement request resolves');
  assert.equal(screen.requests.length, 3);

  const late = setup();
  late.setSession({ uuid: 'account-a' }, false, 1);
  late.render();
  late.setSession({ uuid: 'account-b' }, false, 2);
  late.render();
  late.requests[0].resolve(page([episode]));
  await late.settle();
  assert.equal(late.find(late.tree, 'FlatList').length, 0, 'a late account-A response cannot publish its cards after account B starts loading');
  late.requests[1].resolve(page([preview]));
  await late.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(late.find(late.tree, 'FlatList')[0].props.data.map((item: any) => item.videoUuid))), ['preview-1']);
});

test('history tab loads history cards only and routes preview and episode records like saved cards', async () => {
  const screen = setup();
  screen.render();
  const historyTab = screen.find(screen.tree, 'Pressable').find((node) => node.props.accessibilityRole === 'tab' && node.props.children?.props?.children === '시청 기록');
  assert.ok(historyTab);
  historyTab.props.onPress();
  screen.render();
  assert.equal(screen.requests.length, 0);
  assert.deepEqual(screen.historyRequestPages, []);
  screen.setSession(null, false, 1);
  screen.render();
  assert.equal(screen.find(screen.tree, 'EmptyState')[0]?.props.description, '시청 기록을 보려면 로그인해 주세요.');
  assert.equal(screen.historyRequests.length, 0, 'anonymous history does not issue a request');
  screen.setSession({ uuid: 'account-a' }, true, 2);
  screen.render();
  assert.equal(screen.requests.length, 0, 'history does not call the saved-video API');
  assert.equal(screen.historyRequests.length, 0, 'history waits for session restoration');
  screen.setSession({ uuid: 'account-a' }, false, 2);
  screen.render();
  assert.deepEqual(screen.historyRequestPages, [1]);
  screen.historyRequests[0].resolve(page([historyPreview, historyEpisode]));
  await screen.settle();
  const list = screen.find(screen.tree, 'FlatList')[0];
  assert.deepEqual(list.props.data.map((item: any) => item.videoUuid), ['preview-1', 'episode-video-1']);
  list.props.renderItem({ item: historyPreview }).props.onPress();
  list.props.renderItem({ item: historyEpisode }).props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(screen.routes)), [
    { pathname: '/preview/[dramaId]/[videoId]', params: { dramaId: 'drama-1', videoId: 'preview-1' } },
    { pathname: '/episode/[id]', params: { id: 'episode-1', dramaId: 'drama-2' } },
  ]);
  const card = list.props.renderItem({ item: historyPreview });
  assert.deepEqual(screen.find(card, 'AppText').map((node) => node.props.children), ['작품 하나', '미리보기', '1분']);
  assert.equal(screen.find(card, 'Image').length, 0);
  assert.equal(screen.find(screen.tree, 'AppText').some((node) => node.props.children === historyPreview.lastPlayedAt), false);

  const savedTab = screen.find(screen.tree, 'Pressable').find((node) => node.props.accessibilityRole === 'tab' && node.props.children?.props?.children === '저장한 작품');
  assert.ok(savedTab);
  savedTab.props.onPress();
  screen.render();
  assert.deepEqual(screen.requestPages, [1]);
  assert.deepEqual(screen.historyRequestPages, [1]);
  screen.requests[0].resolve(page([preview], true));
  await screen.settle();
});

test('history retries the same next page, ignores duplicate requests, and deduplicates videos', async () => {
  const screen = setup('history');
  screen.setSession({ uuid: 'account-a' }, false, 1);
  screen.render();
  screen.historyRequests[0].resolve(page([historyPreview], true));
  await screen.settle();

  const more = screen.find(screen.find(screen.tree, 'FlatList')[0].props.ListFooterComponent, 'Button').find((node) => node.props.label === '더 보기');
  assert.ok(more);
  (more.props.onPress as () => void)();
  (more.props.onPress as () => void)();
  assert.deepEqual(screen.historyRequestPages, [1, 2], 'duplicate load-more presses share one in-flight page request');
  screen.historyRequests[1].reject(new Error('offline'));
  await screen.settle();
  assert.equal(screen.find(screen.tree, 'FlatList')[0].props.data.length, 1);
  const retry = screen.find(screen.find(screen.tree, 'FlatList')[0].props.ListFooterComponent, 'Button').find((node) => node.props.label === '다시 시도');
  assert.ok(retry);
  (retry.props.onPress as () => void)();
  assert.deepEqual(screen.historyRequestPages, [1, 2, 2], 'failed page is retried without advancing');
  screen.historyRequests[2].resolve(page([historyPreview, historyEpisode]));
  await screen.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(screen.find(screen.tree, 'FlatList')[0].props.data.map((item: any) => item.videoUuid))), ['preview-1', 'episode-video-1']);
});

test('history distinguishes a first-page failure from an empty result and retries page one', async () => {
  const screen = setup('history');
  screen.setSession({ uuid: 'account-a' }, false, 1);
  screen.render();
  screen.historyRequests[0].reject(new Error('offline'));
  await screen.settle();
  const errorState = screen.find(screen.tree, 'EmptyState').find((node) => node.props.title === '시청 기록을 불러오지 못했어요');
  assert.ok(errorState);
  (errorState.props.onAction as () => void)();
  screen.render();
  assert.deepEqual(screen.historyRequestPages, [1, 1]);
  screen.historyRequests[1].resolve(page([]));
  await screen.settle();
  assert.equal(screen.find(screen.tree, 'EmptyState')[0]?.props.title, '시청 기록이 없어요');
});

test('history hides cards during session changes and ignores late responses after tab switch or refocus', async () => {
  const screen = setup('history');
  screen.setSession({ uuid: 'account-a' }, false, 1);
  screen.render();
  screen.historyRequests[0].resolve(page([historyPreview], true));
  await screen.settle();
  const more = screen.find(screen.find(screen.tree, 'FlatList')[0].props.ListFooterComponent, 'Button').find((node) => node.props.label === '더 보기');
  assert.ok(more);
  (more.props.onPress as () => void)();
  assert.deepEqual(screen.historyRequestPages, [1, 2]);

  screen.setSession({ uuid: 'account-b' }, false, 2);
  screen.render();
  assert.equal(screen.find(screen.tree, 'FlatList').length, 0);
  assert.deepEqual(screen.historyRequestPages, [1, 2, 1]);
  screen.historyRequests[1].resolve(page([historyEpisode]));
  await screen.settle();
  assert.equal(screen.find(screen.tree, 'FlatList').length, 0, 'account A page cannot publish into account B');
  screen.historyRequests[2].resolve(page([historyEpisode]));
  await screen.settle();

  screen.refocus();
  screen.render();
  assert.deepEqual(screen.historyRequestPages, [1, 2, 1, 1]);
  screen.historyRequests[3].reject(new Error('late failure'));
  const savedTab = screen.find(screen.tree, 'Pressable').find((node) => node.props.accessibilityRole === 'tab' && node.props.children?.props?.children === '저장한 작품');
  assert.ok(savedTab);
  savedTab.props.onPress();
  screen.render();
  await screen.settle();
  assert.equal(screen.find(screen.tree, 'EmptyState').some((node) => node.props.title === '시청 기록을 불러오지 못했어요'), false,
    'a late history error does not replace the selected saved tab');
});

test('saved library focus refresh shows server additions and removals and ignores an older next-page response', async () => {
  const screen = setup();
  screen.setSession({ uuid: 'account-a' }, false, 1);
  screen.render();
  screen.requests[0].resolve(page([preview, episode], true));
  await screen.settle();
  const loadMore = () => screen.find(screen.find(screen.tree, 'FlatList')[0].props.ListFooterComponent, 'Button').find((node) => node.props.label === '더 보기');
  const more = loadMore();
  assert.ok(more);
  (more.props.onPress as () => void)();
  assert.deepEqual(screen.requestPages, [1, 2]);

  screen.refocus();
  screen.render();
  assert.deepEqual(screen.requestPages, [1, 2, 1], 'returning to the saved tab always starts at page one');
  screen.requests[1].resolve(page([{ ...episode, videoUuid: 'stale-page-video' }]));
  await screen.settle();
  assert.equal(screen.find(screen.tree, 'FlatList').length, 0,
    'the earlier next-page response is ignored after focus starts a fresh generation');

  const added = { ...preview, videoUuid: 'newly-saved-video', dramaTitle: '새로 저장한 작품' };
  screen.requests[2].resolve(page([added]));
  await screen.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(screen.find(screen.tree, 'FlatList')[0].props.data.map((item: any) => item.videoUuid))), ['newly-saved-video'],
    'the next focus reads the server list, including additions and removals since the previous visit');
});
