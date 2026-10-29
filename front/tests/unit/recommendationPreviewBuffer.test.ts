/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRecommendationPreviewBuffer, type RecommendationPreviewPlayer } from '../../src/features/playback/recommendationPreviewBuffer';

type Target = { dramaId: string; videoId: string };
type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class FakePlayer implements RecommendationPreviewPlayer {
  currentTime = 0;
  status = 'readyToPlay';
  playing = false;
  released = 0;
  readonly events: string[] = [];
  private listeners = new Map<string, Set<(payload: any) => void>>();

  play() { this.events.push('play'); this.playing = true; }
  pause() { this.events.push('pause'); this.playing = false; }
  release() { this.events.push('release'); this.released += 1; }
  addListener(name: string, listener: (payload: any) => void) {
    const entries = this.listeners.get(name) ?? new Set();
    entries.add(listener);
    this.listeners.set(name, entries);
    return { remove: () => {
      if (this.released > 0) throw new Error('listener removed after player release');
      entries.delete(listener);
    } };
  }
  emit(name: string, payload: unknown) {
    for (const listener of this.listeners.get(name) ?? []) listener(payload);
  }
  emitStatus(status: string) {
    this.emit('statusChange', { status });
    this.status = status;
  }
  listenerCount(name: string) { return this.listeners.get(name)?.size ?? 0; }
}

function setupBuffer() {
  const requests: Array<{ target: Target; task: Deferred<{ url: string }> }> = [];
  const players: FakePlayer[] = [];
  const buffer = createRecommendationPreviewBuffer<FakePlayer>(
    (dramaId, videoId) => {
      const task = deferred<{ url: string }>();
      requests.push({ target: { dramaId, videoId }, task });
      return task.promise;
    },
    () => {
      const player = new FakePlayer();
      players.push(player);
      return player;
    },
    () => {},
  );
  return { buffer, requests, players };
}

const target = (index: number): Target => ({ dramaId: `drama-${index}`, videoId: `preview-${index}` });
const flush = async () => { await new Promise<void>((done) => setImmediate(done)); await new Promise<void>((done) => setImmediate(done)); };

test('recommendation buffer retains and reuses only the previous, current, and next players', async () => {
  const { buffer, requests, players } = setupBuffer();
  buffer.retain([target(1), target(2)]);
  await flush();
  assert.deepEqual(requests.map(({ target: item }) => item.videoId), ['preview-1', 'preview-2']);
  requests[0].task.resolve({ url: 'url-1' });
  requests[1].task.resolve({ url: 'url-2' });
  await flush();
  const first = buffer.get(target(1))?.player;
  const second = buffer.get(target(2))?.player;
  assert.equal(players.length, 2);

  buffer.retain([target(1), target(2), target(3)]);
  assert.equal(buffer.get(target(1))?.player, first);
  assert.equal(buffer.get(target(2))?.player, second);
  await flush();
  assert.equal(requests.length, 3);
  requests[2].task.resolve({ url: 'url-3' });
  await flush();

  buffer.retain([target(2), target(3), target(4)]);
  await flush();
  assert.equal(buffer.snapshot().length, 3);
  assert.equal(buffer.get(target(1)), undefined);
  assert.equal(first?.released, 0, 'release waits until the rendered VideoView is detached');
  buffer.releasePending();
  assert.equal(first?.released, 1);
  assert.equal(buffer.get(target(2))?.player, second);
  assert.equal(requests.length, 4);
  buffer.dispose();
  assert.equal(second?.released, 1);
});

test('pending URLs are shared across out-and-back navigation and removed-entry responses are ignored', async () => {
  const { buffer, requests, players } = setupBuffer();
  buffer.retain([target(1), target(2)]);
  await flush();
  const removedEntry = buffer.get(target(1));
  buffer.retain([target(2), target(3)]);
  await flush();
  buffer.retain([target(1), target(2)]);
  assert.equal(requests.filter(({ target: item }) => item.videoId === 'preview-1').length, 1);
  requests[0].task.resolve({ url: 'url-1' });
  requests[1].task.resolve({ url: 'url-2' });
  requests[2].task.resolve({ url: 'url-3' });
  await flush();
  assert.notEqual(buffer.get(target(1)), removedEntry);
  assert.equal(players.length, 2, 'the removed entry response cannot create a second player');
  assert.equal(buffer.get(target(1))?.player, players[0]);
  buffer.dispose();
});

test('responses for entries outside the latest window cannot create players', async () => {
  const { buffer, requests, players } = setupBuffer();
  buffer.retain([target(1), target(2)]);
  await flush();
  buffer.retain([target(2), target(3)]);
  await flush();
  requests[0].task.resolve({ url: 'stale-1' });
  requests[1].task.resolve({ url: 'current-2' });
  await flush();
  assert.equal(buffer.get(target(1)), undefined);
  assert.equal(players.length, 1);
  assert.equal(buffer.get(target(2))?.player, players[0]);
  buffer.dispose();
});

test('tracked player listeners are removed before an evicted player is released', async () => {
  const { buffer, requests, players } = setupBuffer();
  buffer.retain([target(1)]);
  await flush();
  requests[0].task.resolve({ url: 'url-1' });
  await flush();
  const player = players[0];
  const tracked = buffer.trackSubscription(target(1), player, player.addListener('statusChange', () => {}));
  assert.equal(player.listenerCount('statusChange'), 1);
  buffer.retain([target(2)]);
  assert.equal(player.released, 0);
  assert.equal(player.listenerCount('statusChange'), 0);
  buffer.releasePending();
  tracked.remove();
  assert.equal(player.released, 1);
  buffer.dispose();
});

test('blur disposal ignores late requests and failure does not retry until the entry leaves', async () => {
  const { buffer, requests, players } = setupBuffer();
  buffer.retain([target(1)]);
  await flush();
  buffer.retain([target(1)]);
  assert.equal(requests.length, 1);
  requests[0].task.reject(new Error('offline'));
  await flush();
  assert.equal(buffer.get(target(1))?.kind, 'unavailable');
  buffer.retain([target(1)]);
  assert.equal(requests.length, 1);
  buffer.retain([target(2)]);
  buffer.retain([target(1)]);
  await flush();
  assert.equal(requests.length, 3);
  buffer.dispose();
  requests[1].task.resolve({ url: 'late' });
  requests[2].task.resolve({ url: 'late-again' });
  await flush();
  assert.equal(players.length, 0);
  assert.equal(buffer.snapshot().length, 0);
});

test('a page change records a zero seek while a player is still loading and applies it on ready', async () => {
  const request = deferred<{ url: string }>();
  let player: FakePlayer | undefined;
  const buffer = createRecommendationPreviewBuffer<FakePlayer>(
    () => request.promise,
    () => { player = new FakePlayer(); player.status = 'loading'; return player; },
    () => {},
  );
  buffer.retain([target(1)]);
  await flush();
  buffer.resetToBeginning(target(1));
  request.resolve({ url: 'url-1' });
  await flush();
  assert.equal(player?.currentTime, 0);
  player!.currentTime = 28;
  player!.emitStatus('readyToPlay');
  assert.equal(player?.currentTime, 0);
  assert.equal(player?.listenerCount('statusChange'), 0);
  buffer.dispose();
});

type ScreenNode = { type: unknown; props: Record<string, any> };

function createRecommendationScreenHarness(initialPlayerStatus = 'readyToPlay') {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/RecommendationScreen.tsx'), 'utf8');
  const compiled = require(resolve(process.cwd(), 'node_modules/typescript'))
    .transpileModule(source, { compilerOptions: { module: 1, target: 9, jsx: 4 } }).outputText as string;
  const hooks: any[] = [];
  const pending: Array<{ task: Deferred<any>; target: Target }> = [];
  const players: FakePlayer[] = [];
  const timers: Array<{ callback: () => void; cleared: boolean }> = [];
  const modules: Record<string, any> = {};
  let hook = 0;
  let dirty = false;
  let focusCallback: (() => void | (() => void)) | undefined;
  let focusCleanup: (() => void) | undefined;
  let blurred = false;
  let screen!: (props: { initialId?: string }) => ScreenNode;
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props: props ?? {} });
  const react = {
    useState(initial: any) {
      const index = hook++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, (next: any) => {
        const value = typeof next === 'function' ? next(hooks[index].value) : next;
        if (!Object.is(value, hooks[index].value)) { hooks[index].value = value; dirty = true; }
      }];
    },
    useRef(initial: any) {
      const index = hook++;
      if (!hooks[index]) hooks[index] = { value: { current: initial } };
      return hooks[index].value;
    },
    useMemo(factory: () => any, deps: any[]) {
      const index = hook++;
      if (!hooks[index] || deps.some((value, i) => !Object.is(value, hooks[index].deps[i]))) hooks[index] = { value: factory(), deps };
      return hooks[index].value;
    },
    useCallback(callback: (...args: any[]) => any, deps: any[]) {
      const index = hook++;
      if (!hooks[index] || deps.some((value, i) => !Object.is(value, hooks[index].deps[i]))) hooks[index] = { value: callback, deps };
      return hooks[index].value;
    },
    useEffect(effect: () => void | (() => void), deps?: any[]) {
      const index = hook++;
      const previous = hooks[index];
      if (!previous || deps === undefined || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        hooks[index] = { ...previous, effect, deps, pending: true };
      }
    },
  };
  modules.react = react;
  modules['react/jsx-runtime'] = { jsx, jsxs: jsx };
  modules['expo-image'] = { Image: 'Image' };
  modules['expo-linear-gradient'] = { LinearGradient: 'LinearGradient' };
  modules['expo-router'] = {
    useFocusEffect(callback: () => void | (() => void)) {
      if (blurred) return;
      if (callback === focusCallback) return;
      focusCleanup?.();
      focusCallback = callback;
      focusCleanup = callback() ?? undefined;
    },
    useRouter: () => ({ push() {}, canGoBack: () => true, back() {}, replace() {} }),
  };
  modules['expo-video'] = { VideoView: 'VideoView', createVideoPlayer: () => {
    const player = new FakePlayer();
    player.status = initialPlayerStatus;
    players.push(player);
    return player;
  } };
  modules['@react-native-community/slider'] = 'Slider';
  modules['react-native-safe-area-context'] = { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
  modules['react-native'] = {
    FlatList: 'FlatList', Modal: 'Modal', Pressable: 'Pressable', Share: { share() {} },
    StyleSheet: { create: (value: unknown) => value, absoluteFill: { position: 'absolute' } }, View: 'View',
  };
  modules['@/components/ui'] = { AppText: 'AppText', Button: 'Button', EmptyState: 'EmptyState', Icon: 'Icon', Page: 'Page' };
  modules['@/components/EpisodeUnlockDialog'] = { EpisodeUnlockDialog: 'EpisodeUnlockDialog' };
  modules['@/common/media'] = { resolveApiImageUrl: (value: string | null) => value };
  modules['@/common/theme/tokens'] = { colors: { accent: '#0f0', background: '#000', border: '#333', muted: '#aaa', surface: '#111' } };
  modules['@/features/drama/dramaContent'] = { getDramaContent: async () => null };
  modules['@/features/home/homeContent'] = { getHomeCollection: () => home.promise };
  modules['@/features/playback/previewPlayback'] = {
    getPreviewPlayback: (dramaId: string, videoId: string) => {
      const task = deferred<{ url: string }>();
      pending.push({ target: { dramaId, videoId }, task });
      return task.promise;
    },
  };
  modules['@/features/playback/recommendationPreviewBuffer'] = require('../../src/features/playback/recommendationPreviewBuffer');
  const home = deferred<any>();
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(compiled, { exports: module.exports, setTimeout: (callback: () => void) => {
    const timer = { callback, cleared: false }; timers.push(timer); return timer;
  }, clearTimeout: (timer: { cleared: boolean }) => { timer.cleared = true; }, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected module: ${id}`);
    return modules[id];
  } });
  screen = module.exports.RecommendationScreen;
  let tree!: ScreenNode;
  function nodes(root: unknown): ScreenNode[] {
    if (Array.isArray(root)) return root.flatMap(nodes);
    if (!root || typeof root !== 'object') return [];
    const node = root as ScreenNode;
    if (!('type' in node) || !('props' in node)) return [];
    return [node, ...nodes(node.props.children)];
  }
  function commit() {
    let iterations = 0;
    do {
      dirty = false;
      hook = 0;
      tree = screen({});
      for (const state of hooks) {
        if (!state?.pending) continue;
        state.cleanup?.();
        const cleanup = state.effect();
        state.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
        state.pending = false;
      }
      iterations += 1;
      assert.ok(iterations < 20, 'screen effects did not settle');
    } while (dirty);
  }
  const find = (type: string) => {
    const found = nodes(tree).find((node) => node.type === type);
    assert.ok(found, `missing ${type}`);
    return found;
  };
  return {
    commit, find, nodes, pending, players, timers,
    home,
    blur() { focusCleanup?.(); focusCleanup = undefined; focusCallback = undefined; blurred = true; },
  };
}

test('recommendation screen starts from emitted readiness before the player status property updates', async () => {
  const screen = createRecommendationScreenHarness('loading');
  screen.commit();
  screen.home.resolve({ dramas: [1, 2].map((index) => ({
    uuid: `drama-${index}`, displayOrder: index, title: `Drama ${index}`, shortDescription: '',
    genres: [], imageUrls: { poster: `poster-${index}` },
    previewVideos: [{ uuid: `preview-${index}`, storageKey: '', durationMs: 1000 }],
  })) });
  await flush();
  screen.commit();
  await flush();
  screen.pending[0].task.resolve({ url: 'url-1' });
  screen.pending[1].task.resolve({ url: 'url-2' });
  await flush();
  screen.commit();

  const [current, neighbor] = screen.players;
  assert.equal(current.playing, false);
  neighbor.emitStatus('readyToPlay');
  assert.equal(neighbor.playing, false, 'neighbor readiness must not start playback');
  current.emitStatus('readyToPlay');
  assert.equal(current.playing, true, 'emitted readiness starts the current video even while status still reads loading');
  current.pause();
  current.emitStatus('loading');
  current.emitStatus('readyToPlay');
  assert.equal(current.playing, false, 'later readiness must preserve user pause');
  assert.equal(current.events.filter((event) => event === 'play').length, 1);
  screen.blur();
  current.emitStatus('readyToPlay');
  assert.equal(current.playing, false, 'readiness after blur cannot restart playback');
  screen.commit();
});

test('recommendation screen keeps settled page during drag, reuses mounted players, and rejects obsolete settle timers', async () => {
  const screen = createRecommendationScreenHarness();
  screen.commit();
  screen.home.resolve({ dramas: [1, 2, 3, 4].map((index) => ({
    uuid: `drama-${index}`, displayOrder: index, title: `Drama ${index}`, shortDescription: '',
    genres: [], imageUrls: { poster: `poster-${index}` },
    previewVideos: [{ uuid: `preview-${index}`, storageKey: '', durationMs: 1000 }],
  })) });
  await flush();
  screen.commit();
  await flush();
  screen.commit();
  assert.deepEqual(screen.pending.map(({ target: item }) => item.videoId), ['preview-1', 'preview-2']);
  const feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout);
  assert.ok(feed);
  (feed.props.onLayout as (event: any) => void)({ nativeEvent: { layout: { height: 500 } } });
  screen.commit();
  let list = screen.find('FlatList');
  const loadingExtraData = list.props.extraData;
  const loadingCard = list.props.renderItem({ item: list.props.data[0] });
  assert.equal(screen.nodes(loadingCard).some((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer'), false,
    'poster/loading card has no active controls before preview is ready');
  const feedChildren = Array.isArray(feed.props.children) ? feed.props.children : [feed.props.children];
  assert.equal(feedChildren[0].props.pointerEvents, 'none', 'buffer video layer never receives touches');
  assert.equal(screen.nodes(feedChildren[0]).some((node) => node.type === 'Pressable'), false,
    'video layer contains no interactive overlay');
  assert.equal(screen.nodes(feedChildren[0]).some((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer'), false,
    'video layer has no controls component');
  assert.equal(feedChildren[0].props.children.props.style.maxWidth, 500, 'video layer matches the card width');
  screen.pending[0].task.resolve({ url: 'url-1' });
  screen.pending[1].task.resolve({ url: 'url-2' });
  await flush();
  screen.commit();
  const renderedFeed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  const initialFeedNodes = screen.nodes(renderedFeed);
  assert.ok(initialFeedNodes.findIndex((node) => node.type === 'VideoView') < initialFeedNodes.findIndex((node) => node.type === 'FlatList'),
    'FlatList is rendered above the video buffer layer');

  const initialViews = screen.nodes(screen.find('View')).filter((node) => node.type === 'VideoView');
  assert.equal(initialViews.length, 2);
  assert.ok(initialViews.every((node) => node.props.surfaceType === 'textureView'));
  assert.ok(initialViews.every((node) => node.props.pointerEvents === 'none'));
  const player1 = initialViews.find((node) => node.props.player === screen.players[0])?.props.player as FakePlayer;
  const player2 = initialViews.find((node) => node.props.player === screen.players[1])?.props.player as FakePlayer;
  assert.ok(player1);
  assert.ok(player2);
  assert.equal(player1.playing, true);
  assert.equal(player2.playing, false);

  list = screen.find('FlatList');
  assert.notEqual(list.props.extraData, loadingExtraData, 'FlatList refreshes its cards when the players become ready');
  const activeCard = list.props.renderItem({ item: list.props.data[0] });
  assert.ok(screen.nodes(activeCard).some((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer'),
    'active playback controls must be descendants of the FlatList card');
  assert.ok((activeCard.props.style as any[]).some((style) => style?.backgroundColor === 'transparent'),
    'active card background must show the video layer below it');
  assert.equal(screen.nodes(activeCard).some((node) => node.type === 'Image'), false, 'active video card hides its poster');
  const inactiveCard = list.props.renderItem({ item: list.props.data[1] });
  assert.ok(screen.nodes(inactiveCard).some((node) => node.type === 'Image'), 'inactive card retains its poster');
  const pageOneControls = screen.nodes(activeCard).find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer')!;
  const beforeSaveExtraData = list.props.extraData;
  pageOneControls.props.onToggleSave();
  screen.commit();
  list = screen.find('FlatList');
  assert.notEqual(list.props.extraData, beforeSaveExtraData, 'FlatList refreshes when saved state changes');
  assert.ok(list.props.extraData.savedIds.includes('drama-1'));
  assert.equal(list.props.extraData.screenFocused, true);
  assert.equal(list.props.extraData.activeId, 'drama-1');
  assert.equal(list.props.extraData.scrolling, false);
  (list.props.onScrollBeginDrag as () => void)();
  (list.props.onScroll as (event: any) => void)({ nativeEvent: { contentOffset: { y: 500 } } });
  assert.equal(screen.find('FlatList').props.data[0].uuid, 'drama-1', 'dragging does not clear or change the settled list');
  screen.commit();
  const scrollingCard = screen.find('FlatList').props.renderItem({ item: screen.find('FlatList').props.data[0] });
  assert.equal(screen.nodes(scrollingCard).some((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer'), false,
    'controls detach while scrolling');
  assert.ok(screen.nodes(scrollingCard).some((node) => node.type === 'Image'), 'poster stays visible while scrolling');
  assert.notEqual(screen.find('FlatList').props.extraData, list.props.extraData, 'FlatList refreshes cards when scrolling starts');
  list = screen.find('FlatList');
  const staleSettle = screen.timers.filter((timer) => !timer.cleared).at(-1)!;
  (list.props.onMomentumScrollEnd as (event: any) => void)({ nativeEvent: { contentOffset: { y: 500 } } });
  screen.commit();
  assert.equal(player1.currentTime, 0);
  assert.equal(player1.playing, false);
  assert.equal(player2.playing, true);
  let pageTwoList = screen.find('FlatList');
  const pageTwoCard = pageTwoList.props.renderItem({ item: pageTwoList.props.data[1] });
  const pageTwoControls = screen.nodes(pageTwoCard).find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer');
  assert.ok(pageTwoControls, 'page 2 controls move into page 2 card after settle');
  assert.equal(pageTwoControls.props.player, player2, 'card controls use the buffered player');
  assert.ok((pageTwoCard.props.style as any[]).some((style) => style?.backgroundColor === 'transparent'));
  assert.equal(pageTwoList.props.extraData.activeId, 'drama-2');
  await flush();
  assert.equal(screen.pending.length, 3);
  screen.pending[2].task.resolve({ url: 'url-3' });
  await flush();
  screen.commit();
  const nextViews = screen.nodes(screen.find('View')).filter((node) => node.type === 'VideoView');
  assert.ok(nextViews.some((node) => node.props.player === player2), 'player 2 keeps its VideoView when it becomes active');
  assert.equal(player1.released, 0, 'the outgoing adjacent player remains buffered');

  staleSettle.callback();
  screen.commit();
  assert.equal(player2.playing, true, 'an obsolete settle callback cannot rewind the active page');

  pageTwoList = screen.find('FlatList');
  (pageTwoList.props.onScrollBeginDrag as () => void)();
  (pageTwoList.props.onScroll as (event: any) => void)({ nativeEvent: { contentOffset: { y: 1000 } } });
  (pageTwoList.props.onMomentumScrollEnd as (event: any) => void)({ nativeEvent: { contentOffset: { y: 1000 } } });
  screen.commit();
  await flush();
  screen.commit();
  assert.deepEqual(screen.pending.map(({ target: item }) => item.videoId), ['preview-1', 'preview-2', 'preview-3', 'preview-4']);
  const player3 = screen.players[2];
  assert.equal(player1.released, 1, 'player 1 is released only after leaving the adjacent range');
  assert.equal(player2.playing, false);
  assert.equal(player3.playing, true, 'the newly settled current player starts when ready');
  const pageThreeList = screen.find('FlatList');
  const pageThreeCard = pageThreeList.props.renderItem({ item: pageThreeList.props.data[2] });
  const pageThreeControls = screen.nodes(pageThreeCard).find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer');
  assert.ok(pageThreeControls);
  pageThreeControls.props.onError();
  screen.commit();
  assert.equal(screen.find('FlatList').props.extraData.activeEntry.kind, 'unavailable', 'error state refreshes the active card');
  const failedCard = screen.find('FlatList').props.renderItem({ item: screen.find('FlatList').props.data[2] });
  assert.ok(screen.nodes(failedCard).some((node) => node.type === 'Image'), 'failed preview falls back to poster');
  assert.equal(screen.nodes(failedCard).some((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer'), false);
  screen.pending[3].task.resolve({ url: 'url-4' });
  await flush();
  screen.commit();
  assert.equal(screen.players.length, 4);
  assert.equal(screen.players[3].playing, false, 'the following adjacent player stays paused');

  screen.blur();
  screen.commit();
  const blurredList = screen.find('FlatList');
  assert.equal(blurredList.props.extraData.screenFocused, false, 'FlatList refreshes when the screen loses focus');
  const blurredCard = blurredList.props.renderItem({ item: blurredList.props.data[2] });
  assert.equal(screen.nodes(blurredCard).some((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer'), false);
  assert.ok(screen.nodes(blurredCard).some((node) => node.type === 'Image'), 'poster returns after blur');
  screen.pending[2].task.resolve({ url: 'late-url-3' });
  screen.commit();
  await flush();
  screen.commit();
  assert.equal(screen.players.length, 4, 'a response after blur cannot create another player');
  screen.commit();
  assert.equal(player2.released, 1);
  assert.equal(player3.released, 1);
});
