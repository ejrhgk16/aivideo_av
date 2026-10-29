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

function createRecommendationScreenHarness(initialPlayerStatus = 'readyToPlay', platform = 'ios') {
  const source = readFileSync(resolve(process.cwd(), 'src/screens/RecommendationScreen.tsx'), 'utf8');
  const compiled = require(resolve(process.cwd(), 'node_modules/typescript'))
    .transpileModule(source, { compilerOptions: { module: 1, target: 9, jsx: 4 } }).outputText as string;
  const hooks: any[] = [];
  const pending: Array<{ task: Deferred<any>; target: Target }> = [];
  const players: FakePlayer[] = [];
  const timers: Array<{ callback: () => void; delay: number; cleared: boolean }> = [];
  const scrollOffsets: number[] = [];
  let scrollBounds: { contentHeight: number; viewportHeight: number } | null = null;
  let boundedOffset = 0;
  const frames = new Map<number, (time: number) => void>();
  const wheelListeners = new Map<string, { listener: (event: any) => void; options: any }>();
  const domListeners = new Map<string, Array<{ listener: (event: any) => void; capture: boolean }>>();
  const feedNode = {
    addEventListener: (name: string, listener: (event: any) => void, options: any) => {
      if (name === 'wheel') wheelListeners.set(name, { listener, options });
      const listeners = domListeners.get(name) ?? [];
      listeners.push({ listener, capture: options === true });
      domListeners.set(name, listeners);
    },
    removeEventListener: (name: string, listener: (event: any) => void) => {
      if (wheelListeners.get(name)?.listener === listener) wheelListeners.delete(name);
      domListeners.set(name, (domListeners.get(name) ?? []).filter((entry) => entry.listener !== listener));
    },
  };
  let frameId = 0;
  let frameTime = 0;
  const modules: Record<string, any> = {};
  let hook = 0;
  const componentHookStarts = new Map<string, number>();
  let dirty = false;
  let focusCallback: (() => void | (() => void)) | undefined;
  let focusCleanup: (() => void) | undefined;
  let blurred = false;
  class FakeElement {
    constructor(private readonly interactive: boolean) {}
    closest() { return this.interactive ? {} : null; }
  }
  let screen!: (props: { initialId?: string }) => ScreenNode;
  const jsx = (type: unknown, props: Record<string, any>, key?: string) => ({
    type,
    props: { ...(props ?? {}), ...(key === undefined ? {} : { key }) },
  });
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
    Platform: { OS: platform },
    FlatList: 'FlatList', Modal: 'Modal', Pressable: 'Pressable', Share: { share() {} },
    PanResponder: { create: (config: any) => ({ panHandlers: config }) },
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
  vm.runInNewContext(compiled, { exports: module.exports, Element: FakeElement, performance: { now: () => frameTime },
    requestAnimationFrame: (callback: (time: number) => void) => { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => frames.delete(id), setTimeout: (callback: () => void, delay = 0) => {
    const timer = { callback, delay, cleared: false }; timers.push(timer); return timer;
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
      const visit = (value: unknown) => {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (!value || typeof value !== 'object') return;
        const node = value as ScreenNode;
        if ('type' in node && 'props' in node) {
          if (typeof node.props.ref === 'function') node.props.ref(feedNode);
          else if (node.props.ref && 'current' in node.props.ref && node.type === 'View' && node.props.onLayout) node.props.ref.current = feedNode;
          if (node.type === 'FlatList' && node.props.ref && !node.props.ref.current) {
            node.props.ref.current = { scrollToOffset: ({ offset }: { offset: number }) => {
              scrollOffsets.push(offset);
              boundedOffset = scrollBounds
                ? Math.max(0, Math.min(offset, scrollBounds.contentHeight - scrollBounds.viewportHeight))
                : offset;
            } };
          }
          visit(node.props.children);
        }
      };
      visit(tree);
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
  const render = (element: ScreenNode) => {
    const parentHook = hook;
    const identity = `${(element.type as any).name}:${element.props.key ?? ''}`;
    if (!componentHookStarts.has(identity)) componentHookStarts.set(identity, hooks.length);
    hook = componentHookStarts.get(identity)!;
    const rendered = (element.type as (props: Record<string, any>) => unknown)(element.props);
    hook = parentHook;
    return rendered;
  };
  return {
    commit, find, nodes, render, pending, players, timers, scrollOffsets, frames, wheelListeners,
    setScrollBounds(contentHeight: number, viewportHeight: number) {
      scrollBounds = { contentHeight, viewportHeight };
      boundedOffset = Math.max(0, Math.min(boundedOffset, contentHeight - viewportHeight));
    },
    boundedOffset: () => boundedOffset,
    nextFrame(time = frameTime + 50) {
      frameTime = time;
      const scheduled = [...frames.values()];
      frames.clear();
      scheduled.forEach((callback) => callback(frameTime));
    },
    advanceTime(milliseconds: number) { frameTime += milliseconds; },
    dispatchWheel(event: any) {
      const wheel = wheelListeners.get('wheel');
      assert.ok(wheel, 'the feed registers a wheel listener');
      wheel.listener({ preventDefault() { event.prevented = true; }, ...event });
    },
    dispatchDOMEvent(name: string, event: any) {
      for (const { listener, capture } of domListeners.get(name) ?? []) {
        if (capture) listener(event);
      }
    },
    element(interactive: boolean) { return new FakeElement(interactive); },
    home,
    blur() { focusCleanup?.(); focusCleanup = undefined; focusCallback = undefined; blurred = true; },
    focus() { blurred = false; commit(); },
  };
}

test('recommendation mounts idle web players so canplay can make current and neighbor videos visible', async () => {
  const screen = createRecommendationScreenHarness('idle');
  screen.commit();
  screen.home.resolve({ dramas: [1, 2].map((index) => ({
    uuid: `drama-${index}`, displayOrder: index, title: `Drama ${index}`, shortDescription: '',
    genres: [], imageUrls: { poster: `poster-${index}` },
    previewVideos: [{ uuid: `preview-${index}`, storageKey: '', durationMs: 1000 }],
  })) });
  await flush();
  screen.commit();
  const feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  (feed.props.onLayout as (event: any) => void)({ nativeEvent: { layout: { height: 500 } } });
  screen.commit();
  await flush();
  screen.pending[0].task.resolve({ url: 'url-1' });
  screen.pending[1].task.resolve({ url: 'url-2' });
  await flush();
  screen.commit();

  const [current, neighbor] = screen.players;
  const list = screen.find('FlatList');
  const loadingCard = list.props.renderItem({ item: list.props.data[0] });
  assert.equal(screen.nodes(loadingCard).some((node) => node.type === 'Image'), false, 'a loading player shows a black frame instead of the poster');
  const videoView = (player: FakePlayer) => screen.nodes(screen.find('FlatList').props.renderItem({
    item: screen.find('FlatList').props.data.find((drama: any) => drama.uuid === `drama-${current === player ? 1 : 2}`),
  })).find((node) => node.type === 'VideoView' && node.props.player === player);
  const currentView = videoView(current);
  const neighborView = videoView(neighbor);
  assert.ok(currentView, 'the idle web player is mounted so its HTML video can start loading');
  assert.ok(neighborView, 'the idle neighbor player is mounted so its HTML video can start loading');
  assert.equal((currentView.props.style as any[]).at(-1).opacity, 0, 'an unprepared player stays hidden behind the black card');
  assert.equal(current.playing, false);
  const currentKey = currentView.props.key;
  assert.equal(currentKey, JSON.stringify(['drama-1', 'preview-1']), 'the mounted view has a stable player key');
  current.emitStatus('readyToPlay');
  screen.commit();
  const preparedCurrentView = videoView(current);
  assert.equal(preparedCurrentView?.props.key, currentKey, 'readiness preserves the mounted VideoView identity');
  assert.equal((preparedCurrentView?.props.style as any[]).at(-1).opacity, 1, 'canplay reveals the mounted video');
  assert.equal(current.playing, true, 'readiness starts the active player');
  neighbor.emitStatus('readyToPlay');
  screen.commit();
  assert.equal((videoView(neighbor)?.props.style as any[]).at(-1).opacity, 1, 'canplay reveals the prepared neighbor');
  assert.equal(neighbor.playing, false, 'neighbor readiness must not start playback');
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


async function loadScreen(screen: ReturnType<typeof createRecommendationScreenHarness>, count = 4, resolvePlayers = true) {
  screen.commit();
  screen.home.resolve({ dramas: Array.from({ length: count }, (_, i) => ({
    uuid: `drama-${i + 1}`, displayOrder: i + 1, title: `Drama ${i + 1}`, shortDescription: '',
    genres: [], imageUrls: { poster: `poster-${i + 1}` },
    previewVideos: [{ uuid: `preview-${i + 1}`, storageKey: '', durationMs: 1000 }],
  })) });
  await flush(); screen.commit();
  let feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  feed.props.onLayout({ nativeEvent: { layout: { height: 500 } } });
  screen.commit(); await flush(); screen.commit();
  if (resolvePlayers) {
    for (const item of screen.pending) item.task.resolve({ url: `url-${item.target.videoId}` });
    await flush(); screen.commit();
  }
  return screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
}
function offset(screen: ReturnType<typeof createRecommendationScreenHarness>, y: number) {
  screen.find('FlatList').props.onScroll({ nativeEvent: { contentOffset: { y } } }); screen.commit();
}
function frames(screen: ReturnType<typeof createRecommendationScreenHarness>, sync = false) {
  for (let i = 0; screen.frames.size; i++) {
    assert.ok(i < 10); screen.nextFrame();
    if (sync && screen.scrollOffsets.length) offset(screen, screen.scrollOffsets.at(-1)!);
  }
  screen.commit();
}
function drag(screen: ReturnType<typeof createRecommendationScreenHarness>) {
  const p = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!.props;
  assert.equal(p.onMoveShouldSetPanResponder({}, { dx: 0, dy: -20 }), true);
  p.onPanResponderGrant({}, { dx: 0, dy: -20 });
  return { move(dy: number, vy = 0) { p.onPanResponderMove({}, { dx: 0, dy, vy }); },
    release(dy: number) { p.onPanResponderRelease({}, { dx: 0, dy }); },
    cancel() { p.onPanResponderTerminate({}, { dx: 0, dy: 0 }); } };
}
function quiet(screen: ReturnType<typeof createRecommendationScreenHarness>) {
  const timer = screen.timers.filter((item) => !item.cleared).at(-1)!; assert.ok(timer); timer.callback();
}

test('drag follows the pointer and switches playback only after actual target arrival', async () => {
  const screen = createRecommendationScreenHarness(); await loadScreen(screen);
  const [current, next] = screen.players; current.currentTime = 17;
  const list = screen.find('FlatList');
  assert.equal(list.props.scrollEnabled, false);
  assert.equal(list.props.pagingEnabled, undefined);
  assert.equal(list.props.snapToInterval, undefined);
  assert.equal(list.props.disableIntervalMomentum, undefined);
  const feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!.props;
  assert.equal(feed.onStartShouldSetPanResponder(), false);
  assert.equal(feed.onMoveShouldSetPanResponder({}, { dx: 18, dy: 10 }), false);
  assert.equal(feed.onMoveShouldSetPanResponder({}, { dx: 0, dy: 9 }), false);
  const g = drag(screen); g.move(-300); assert.equal(screen.scrollOffsets.at(-1), 300); offset(screen, 100);
  assert.equal(current.playing, true); g.release(-250); screen.nextFrame();
  assert.ok(screen.scrollOffsets.at(-1)! > 300, 'RAF interpolation starts at the latest requested drag position');
  frames(screen);
  assert.equal(screen.scrollOffsets.at(-1), 500); assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-1');
  assert.equal(current.playing, true); assert.equal(next.playing, false);
  offset(screen, 500); assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  const settledRequests = screen.scrollOffsets.length;
  offset(screen, 502);
  assert.equal(screen.scrollOffsets.length, settledRequests, 'arrival does not start a corrective scroll');
  assert.equal(screen.frames.size, 0, 'arrival leaves no trailing animation frame');
  assert.equal(current.currentTime, 0); assert.equal(next.playing, true);
  const reverse = drag(screen); reverse.move(-300); reverse.move(0); offset(screen, 500); reverse.release(0); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  screen.blur(); screen.commit();
});

test('fast swipes use recent velocity, distance, freshness, and final direction only on release', async () => {
  const screen = createRecommendationScreenHarness(); await loadScreen(screen);
  const activeId = () => screen.find('FlatList').props.extraData.activeId;
  const settle = (gesture: ReturnType<typeof drag>, dy: number, nextId: string | null) => {
    const startId = activeId();
    gesture.release(dy);
    assert.equal(activeId(), startId, 'release chooses a destination but playback waits for actual arrival');
    if (nextId === null) {
      if (screen.frames.size) frames(screen, true);
      assert.equal(activeId(), startId, 'an ineligible short swipe returns to its starting page');
      return;
    }
    assert.ok(screen.frames.size > 0, 'an eligible swipe starts its page transition');
    frames(screen, true);
    assert.equal(activeId(), nextId);
  };

  const fast = drag(screen);
  fast.move(-80, -0.5);
  offset(screen, 80);
  assert.equal(activeId(), 'drama-1', 'movement never commits before release');
  assert.equal(screen.frames.size, 0);
  settle(fast, -80, 'drama-2');

  const slow = drag(screen); slow.move(-80, -0.49); settle(slow, -80, null);
  const tooShort = drag(screen); tooShort.move(-49, -2); settle(tooShort, -49, null);

  const exactBoundary = drag(screen); exactBoundary.move(-50, -0.5); screen.advanceTime(100);
  settle(exactBoundary, -50, 'drama-3');
  const stale = drag(screen); stale.move(-80, -1); screen.advanceTime(101);
  settle(stale, -80, null);

  const reversed = drag(screen); reversed.move(-100, -1); reversed.move(-80, 1);
  settle(reversed, -80, null);

  const heldThenFlicked = drag(screen); screen.advanceTime(1000); heldThenFlicked.move(-80, -1);
  settle(heldThenFlicked, -80, 'drama-4');
  const backward = drag(screen); backward.move(80, 0.5); settle(backward, 80, 'drama-3');
  const invalidVelocity = drag(screen); invalidVelocity.move(-80, Number.NaN); settle(invalidVelocity, -80, null);
  const infiniteVelocity = drag(screen); infiniteVelocity.move(-80, Number.POSITIVE_INFINITY); settle(infiniteVelocity, -80, null);
  screen.blur(); screen.commit();
});

test('PanResponder preserves controls, cancel, half-page and edge behavior', async () => {
  const screen = createRecommendationScreenHarness(); await loadScreen(screen, 2);
  const list = screen.find('FlatList'), card = list.props.renderItem({ item: list.props.data[0] });
  const controls = screen.nodes(card).find((n) => (n.type as any)?.name === 'RecommendationPreviewPlayer')!;
  const playerControls = screen.nodes(screen.render(controls));
  const slider = playerControls.find((n) => n.type === 'Slider')!;
  assert.equal(typeof slider.props.onTouchStart, 'function');
  assert.equal(playerControls.filter((n) => n.type === 'Pressable').every((n) => !n.props.onTouchStart), true, 'ordinary buttons do not block feed drags');
  const feed = screen.nodes(screen.find('Page')).find((n) => n.type === 'View' && n.props.onLayout)!.props;
  slider.props.onTouchStart();
  assert.equal(feed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -100 }), false, 'a slider-start gesture cannot become a page drag');
  slider.props.onSlidingStart();
  slider.props.onTouchCancel();
  assert.equal(feed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -100 }), true, 'cancel clears the slider exclusion even without slidingComplete');
  slider.props.onTouchStart();
  slider.props.onSlidingStart();
  slider.props.onTouchEnd();
  assert.equal(feed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -100 }), false, 'touch end alone keeps an active seek excluded');
  slider.props.onValueChange(18);
  slider.props.onSlidingComplete(18);
  assert.equal(controls.props.player.currentTime, 18, 'slidingComplete commits the requested seek position');
  assert.equal(feed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -100 }), true, 'slidingComplete restores feed drags');
  const cancel = drag(screen); cancel.move(-200, -10); offset(screen, 200); cancel.cancel(); frames(screen, true);
  const short = drag(screen); short.move(-249); offset(screen, 249); short.release(-249); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-1');
  const pausedPlayer = screen.players[0]; pausedPlayer.currentTime = 12; pausedPlayer.pause();
  const pausedReturn = drag(screen); pausedReturn.move(-200); offset(screen, 200); pausedReturn.release(-200); frames(screen, true);
  assert.equal(pausedPlayer.currentTime, 12, 'returning to the active card preserves its playhead');
  assert.equal(pausedPlayer.playing, false, 'returning does not resume a user-paused preview');
  const next = drag(screen); next.move(-300); offset(screen, 300); next.release(-250); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  const edge = drag(screen); edge.move(-500); offset(screen, 500); edge.release(-500); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  const back = drag(screen); back.move(500); offset(screen, 0); back.release(500); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-1');
  const firstEdge = drag(screen); firstEdge.move(500); offset(screen, 0); firstEdge.release(500); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-1', 'the first item does not wrap backward');
  assert.ok(screen.scrollOffsets.every((value) => value >= 0 && value <= 500));
  screen.blur(); screen.commit();
});

test('a tap on the background does not mount hidden buttons under its touch', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen, 2);
  const preview = screen.nodes(screen.find('FlatList').props.renderItem({ item: screen.find('FlatList').props.data[0] }))
    .find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer')!;
  screen.render(preview);
  screen.commit();
  const mountedPreview = screen.nodes(screen.find('FlatList').props.renderItem({ item: screen.find('FlatList').props.data[0] }))
    .find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer')!;
  let tree = screen.render(mountedPreview);
  const background = () => screen.nodes(tree).find((node) => node.type === 'Pressable'
    && node.props.accessibilityLabel === '재생 컨트롤 표시 또는 숨기기')!;
  background().props.onPress();
  tree = screen.render(mountedPreview);
  assert.equal(screen.nodes(tree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '재생'), false,
    'hidden controls are absent before a background tap begins');

  const wrapper = screen.nodes(tree).find((node) => node.type === 'View' && node.props.onTouchStart)!;
  wrapper.props.onTouchStart();
  tree = screen.render(mountedPreview);
  assert.equal(screen.nodes(tree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '재생'), false,
    'a hidden control subtree is not mounted while the background owns the touch');
  screen.nodes(tree).find((node) => node.type === 'View' && node.props.onTouchEnd)!.props.onTouchEnd();
  background().props.onPress();
  tree = screen.render(mountedPreview);
  assert.ok(screen.nodes(tree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '일시정지'),
    'the background press can show controls after its own touch completes');
});

test('the first drag keeps its original visible background target and controls mounted until release', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen, 2);
  const findPreview = () => {
    const list = screen.find('FlatList');
    const card = list.props.renderItem({ item: list.props.data[0] });
    return screen.nodes(card).find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer');
  };
  const resolveAttachedBackground = (key: string) => {
    const preview = findPreview();
    if (!preview || preview.props.key !== key) return undefined;
    return screen.nodes(screen.render(preview)).find((node) =>
      node.type === 'Pressable' && node.props.accessibilityLabel === '재생 컨트롤 표시 또는 숨기기');
  };
  let initialPreview = findPreview();
  assert.ok(initialPreview);
  const initialKey = initialPreview.props.key;
  screen.render(initialPreview);
  screen.commit();
  initialPreview = findPreview()!;
  let initialTree = screen.render(initialPreview);
  const initialButton = screen.nodes(initialTree).find((node) =>
    node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장');
  assert.ok(initialButton);
  screen.nodes(initialTree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '일시정지')!.props.onPress();
  const initialWrapper = screen.nodes(initialTree).find((node) => node.type === 'View' && node.props.onTouchStart)!;
  initialWrapper.props.onTouchStart();
  const initialBackground = screen.nodes(initialTree).find((node) => node.type === 'Pressable'
    && node.props.accessibilityLabel === '재생 컨트롤 표시 또는 숨기기')!;
  let currentTree = screen.render(initialPreview);
  const hideTimer = screen.timers.filter((timer) => timer.delay === 4000 && !timer.cleared).at(-1)!;
  assert.ok(hideTimer);
  hideTimer.callback();
  currentTree = screen.render(initialPreview);
  assert.ok(screen.nodes(currentTree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장'),
    'the four-second hide keeps a control that began the active touch in the subtree');

  const feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!.props;
  assert.equal(feed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -12 }), true);
  feed.onPanResponderGrant({}, { dx: 0, dy: -12 });
  screen.commit();

  const duringDrag = findPreview();
  assert.ok(duringDrag, 'the preview component remains attached after the feed grants the gesture');
  assert.equal(duringDrag.props.key, initialKey, 'the original preview key remains stable while the finger is down');
  currentTree = screen.render(duringDrag);
  const currentBackground = screen.nodes(currentTree).find((node) => node.type === 'Pressable'
    && node.props.accessibilityLabel === '재생 컨트롤 표시 또는 숨기기');
  assert.ok(currentBackground, 'the original background touch target remains attached after responder grant');
  assert.equal(screen.nodes(currentTree).indexOf(currentBackground), screen.nodes(initialTree).indexOf(initialBackground),
    'the same keyed preview keeps the background Pressable in its original tree position');
  const currentButton = screen.nodes(currentTree).find((node) =>
    node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장');
  assert.ok(currentButton, 'the control subtree that was visible at touch-start remains attached');
  assert.equal(currentButton.props.accessibilityLabel, initialButton.props.accessibilityLabel);
  let deliveredMoves = 0;
  for (const dy of [-80, -160]) {
    if (!resolveAttachedBackground(initialKey)) break;
    feed.onPanResponderMove({}, { dx: 0, dy });
    deliveredMoves += 1;
    screen.commit();
  }
  assert.equal(deliveredMoves, 2, 'each move is delivered only while the original background target resolves from the current tree');
  let movedPreview = findPreview();
  assert.ok(movedPreview, 'later moves keep the original touch target mounted');
  currentTree = screen.render(movedPreview);
  assert.ok(screen.nodes(currentTree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장'),
    'buttons remain in the attached controls subtree throughout the drag');
  if (resolveAttachedBackground(initialKey)) feed.onPanResponderRelease({}, { dx: 0, dy: -160 });
  else assert.fail('the release cannot be delivered after the original touch target detaches');
  const endingWrapper = screen.nodes(screen.render(movedPreview)).find((node) => node.type === 'View' && node.props.onTouchEnd)!;
  endingWrapper.props.onTouchEnd();
  screen.timers.filter((timer) => timer.delay === 0 && !timer.cleared).at(-1)!.callback();
  currentTree = screen.render(movedPreview);
  assert.equal(screen.nodes(currentTree).find((node) => node.type === 'View' && node.props.onTouchStart)?.props.pointerEvents, 'none');
  assert.equal(screen.nodes(currentTree).some((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장'), false,
    'controls can be removed after the active touch has ended');
  frames(screen, true);
  screen.blur(); screen.commit();
});

test('a vertical drag starting on a Pressable cancels its web click, while the next tap runs once', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen, 2);
  const list = screen.find('FlatList'), card = list.props.renderItem({ item: list.props.data[0] });
  const control = screen.nodes(card).find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer')!;
  let saves = 0;
  const button = screen.nodes(screen.render({ ...control, props: { ...control.props, onToggleSave: () => { saves += 1; } } }))
    .find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장')!;
  const WebPressResponder = require(resolve(process.cwd(), 'node_modules/react-native-web/dist/cjs/modules/usePressEvents/PressResponder.js'));
  const webPress = new WebPressResponder({ onPress: button.props.onPress, cancelable: true, delayPressStart: 0, delayLongPress: 60000 });
  const pressHandlers = webPress.getEventHandlers();
  const pressEvent = () => ({ nativeEvent: { type: 'touchstart', pageX: 4, pageY: 8, touches: [{ pageX: 4, pageY: 8 }] }, persist() {} });
  const feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!.props;
  assert.equal(feed.onStartShouldSetPanResponder(), false, 'the feed does not claim the child Pressable at touch start');
  assert.equal(pressHandlers.onStartShouldSetResponder(pressEvent()), true, 'the child PressResponder owns a normal press start');
  pressHandlers.onResponderGrant(pressEvent());
  assert.equal(feed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -12 }), true, 'the feed takes the responder after vertical movement');
  assert.equal(pressHandlers.onResponderTerminationRequest(pressEvent()), true, 'the Pressable allows a parent vertical drag to take ownership');
  pressHandlers.onResponderTerminate({ ...pressEvent(), nativeEvent: { type: 'touchcancel' } });
  feed.onPanResponderGrant({}, { dx: 0, dy: -12 });
  screen.commit();
  const attachedControl = screen.nodes(screen.find('FlatList').props.renderItem({ item: screen.find('FlatList').props.data[0] }))
    .find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer');
  assert.ok(attachedControl, 'the button-start gesture keeps its keyed preview attached');
  assert.equal(attachedControl.props.key, control.props.key);
  const attachedButton = screen.nodes(screen.render({ ...attachedControl, props: { ...attachedControl.props, onToggleSave: () => { saves += 1; } } }))
    .find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장');
  assert.ok(attachedButton, 'the current rendered tree still contains the button that began the touch');
  if (attachedButton) feed.onPanResponderMove({}, { dx: 0, dy: -40 });
  screen.commit();
  const buttonAfterMove = screen.nodes(screen.render(attachedControl)).find((node) => node.type === 'Pressable'
    && node.props.accessibilityLabel === '작품 저장');
  assert.ok(buttonAfterMove, 'the button remains resolvable after later move events');
  feed.onPanResponderRelease({}, { dx: 0, dy: -40 });

  await new Promise<void>((resolve) => setTimeout(resolve, 300));
  const draggedClick: any = { detail: 1, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  screen.dispatchDOMEvent('click', draggedClick);
  if (!draggedClick.stopped) pressHandlers.onClick({ ...draggedClick, altKey: false });
  assert.equal(draggedClick.prevented, true, 'the delayed compatibility click for the claimed drag is stopped at the feed');
  assert.equal(saves, 0, 'the drag does not trigger the button action');

  screen.dispatchDOMEvent('pointerdown', {});
  const tapClick: any = { detail: 1, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  screen.dispatchDOMEvent('click', tapClick);
  pressHandlers.onResponderGrant(pressEvent());
  pressHandlers.onResponderRelease(pressEvent());
  if (!tapClick.stopped) pressHandlers.onClick({ ...tapClick, altKey: false });
  assert.equal(tapClick.prevented, false, 'a new independent press clears any unused drag suppression');
  assert.equal(saves, 1, 'the next real tap invokes the Pressable action exactly once');
  feed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -12 });
  feed.onPanResponderGrant({}, { dx: 0, dy: -12 });
  feed.onPanResponderRelease({}, { dx: 0, dy: -40 });
  screen.dispatchDOMEvent('touchstart', {});
  const touchTap: any = { detail: 1, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
  screen.dispatchDOMEvent('click', touchTap);
  pressHandlers.onResponderGrant(pressEvent());
  pressHandlers.onResponderRelease(pressEvent());
  if (!touchTap.prevented) pressHandlers.onClick({ ...touchTap, altKey: false });
  assert.equal(saves, 2, 'a new touch clears stale suppression if the previous drag produced no compatibility click');
  feed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -12 });
  feed.onPanResponderGrant({}, { dx: 0, dy: -12 });
  feed.onPanResponderRelease({}, { dx: 0, dy: -40 });
  screen.dispatchDOMEvent('keydown', {});
  const keyboardClick: any = { detail: 0, prevented: false, altKey: false, stopPropagation() {}, preventDefault() { this.prevented = true; } };
  screen.dispatchDOMEvent('click', keyboardClick);
  pressHandlers.onClick(keyboardClick);
  assert.equal(saves, 3, 'keyboard and assistive activation bypasses stale pointer suppression');
  webPress.reset();

  const native = createRecommendationScreenHarness('readyToPlay', 'ios'); await loadScreen(native, 2);
  const nativeList = native.find('FlatList'), nativeCard = nativeList.props.renderItem({ item: nativeList.props.data[0] });
  const nativeControl = native.nodes(nativeCard).find((node) => (node.type as any)?.name === 'RecommendationPreviewPlayer')!;
  let nativeSaves = 0;
  const nativeButton = native.nodes(native.render({ ...nativeControl, props: { ...nativeControl.props, onToggleSave: () => { nativeSaves += 1; } } }))
    .find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === '작품 저장')!;
  const nativeFeed = native.nodes(native.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!.props;
  let nativeChildOwnsPress = false;
  const nativePressable = {
    grant() { nativeChildOwnsPress = true; },
    terminate() { nativeChildOwnsPress = false; },
    release() { if (nativeChildOwnsPress) { nativeChildOwnsPress = false; nativeButton.props.onPress(); } },
  };
  nativePressable.grant();
  assert.equal(nativeFeed.onMoveShouldSetPanResponderCapture({}, { dx: 0, dy: -12 }), true, 'native parent capture takes the responder from the child press');
  nativePressable.terminate();
  nativeFeed.onPanResponderGrant({}, { dx: 0, dy: -12 });
  nativeFeed.onPanResponderMove({}, { dx: 0, dy: -40 });
  nativeFeed.onPanResponderRelease({}, { dx: 0, dy: -40 });
  nativePressable.release();
  assert.equal(nativeSaves, 0, 'a native Pressable terminated by the parent drag does not run onPress');
  nativePressable.grant();
  nativePressable.release();
  assert.equal(nativeSaves, 1, 'an independent native child grant and release runs the button action once');
});

test('web wheel normalizes deltas and waits for actual arrival and 150ms quiet', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen);
  assert.equal(screen.wheelListeners.get('wheel')?.options.passive, false);
  const lineDelta: any = { deltaX: 0, deltaY: 3, deltaMode: 1, target: null };
  screen.dispatchWheel(lineDelta);
  assert.equal(lineDelta.prevented, true, 'valid vertical feed wheel input prevents browser scrolling');
  assert.equal(screen.scrollOffsets.length, 0);
  screen.dispatchWheel({ deltaX: 0, deltaY: 40, deltaMode: 0, target: null });
  screen.dispatchWheel({ deltaX: 0, deltaY: -20, deltaMode: 0, target: null });
  screen.dispatchWheel({ deltaX: 0, deltaY: 25, deltaMode: 0, target: null });
  assert.equal(screen.scrollOffsets.length, 0, 'direction change resets partial accumulation');
  screen.dispatchWheel({ deltaX: 0, deltaY: 100, deltaMode: 0, target: null }); quiet(screen); frames(screen);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-1');
  offset(screen, 500); assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  screen.dispatchWheel({ deltaX: 0, deltaY: 0.2, deltaMode: 2, target: null });
  assert.ok(screen.frames.size, 'page-mode delta is converted to pixels and starts one motion');
  frames(screen);
  assert.equal(screen.scrollOffsets.at(-1), 1000, 'page-mode delta requests the next page');
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  offset(screen, 1000);
  const arrivedRequests = screen.scrollOffsets.length;
  screen.dispatchWheel({ deltaX: 0, deltaY: 12, deltaMode: 0, target: null });
  frames(screen, true);
  assert.equal(screen.scrollOffsets.length, arrivedRequests, 'inertia tail cannot schedule another page');
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-3');
  quiet(screen); screen.blur(); screen.commit(); assert.equal(screen.wheelListeners.size, 0);
});

test('wheel inertia during motion is consumed; resize and blur cancel stale animation frames', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen, 3);
  screen.dispatchWheel({ deltaX: 0, deltaY: 110, deltaMode: 0, target: null });
  screen.dispatchWheel({ deltaX: 0, deltaY: 12, deltaMode: 0, target: null }); quiet(screen); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  screen.dispatchWheel({ deltaX: 0, deltaY: 110, deltaMode: 0, target: null });
  const feed = screen.nodes(screen.find('Page')).find((n) => n.type === 'View' && n.props.onLayout)!;
  feed.props.onLayout({ nativeEvent: { layout: { height: 600 } } }); screen.commit();
  screen.find('FlatList').props.onContentSizeChange(1100, 1800);
  assert.equal(screen.frames.size, 0); assert.equal(screen.scrollOffsets.at(-1), 600);
  const activeCard = screen.find('FlatList').props.renderItem({ item: screen.find('FlatList').props.data[1] });
  const controls = screen.nodes(activeCard).find((n) => (n.type as any)?.name === 'RecommendationPreviewPlayer');
  controls?.props.onSeekTouch(true);
  screen.dispatchWheel({ deltaX: 0, deltaY: 110, deltaMode: 0, target: null });
  screen.blur(); screen.commit();
  assert.equal(screen.frames.size, 0); assert.equal(screen.wheelListeners.size, 0);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  screen.focus();
  assert.equal(screen.scrollOffsets.at(-1), 600, 'focus return aligns to the last committed card');
  screen.blur(); screen.commit(); screen.focus();
  const focusedFeed = screen.nodes(screen.find('Page')).find((n) => n.type === 'View' && n.props.onLayout)!.props;
  assert.equal(focusedFeed.onMoveShouldSetPanResponder({}, { dx: 0, dy: -40 }), true, 'blur clears a control touch that never ended');
  screen.blur(); screen.commit();
});

test('resize waits for the latest content size and aligns the actual offset on the last card', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen, 4);
  screen.setScrollBounds(2000, 500);
  for (let index = 1; index < 4; index += 1) {
    const gesture = drag(screen);
    gesture.move(-300); gesture.release(-300); frames(screen, true);
  }
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-4');
  assert.equal(screen.boundedOffset(), 1500);
  for (let pass = 0; pass < 3; pass += 1) {
    for (const request of screen.pending) request.task.resolve({ url: `url-${request.target.videoId}` });
    await flush(); screen.commit();
  }
  const activePlayer = screen.players.find((player) => player.playing)!;
  assert.ok(activePlayer, 'the committed last card has an active preview player');
  activePlayer.currentTime = 12;
  const activePlayerEvents = [...activePlayer.events];

  const previousRequestCount = screen.scrollOffsets.length;
  let feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  feed.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
  screen.setScrollBounds(2000, 800);
  offset(screen, screen.boundedOffset());
  assert.equal(screen.scrollOffsets.length, previousRequestCount, 'no target request is made against the old 2000px content');
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-4', 'clamping does not change the committed drama');

  let list = screen.find('FlatList');
  list.props.onContentSizeChange(1100, 2000);
  assert.equal(screen.scrollOffsets.length, previousRequestCount, 'a stale old content size cannot trigger alignment');
  screen.setScrollBounds(3200, 800);
  list.props.onContentSizeChange(1100, 3200);
  assert.equal(screen.scrollOffsets.at(-1), 2400);
  assert.equal(screen.boundedOffset(), 2400, 'the final card is reachable with the committed content and viewport sizes');
  offset(screen, screen.boundedOffset());
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-4');
  assert.equal(activePlayer.playing, true);
  assert.equal(activePlayer.currentTime, 12);
  assert.deepEqual(activePlayer.events, activePlayerEvents, 'resizing does not restart or pause the preview');

  const afterGrowRequestCount = screen.scrollOffsets.length;
  feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  feed.props.onLayout({ nativeEvent: { layout: { height: 700 } } });
  screen.setScrollBounds(3200, 700);
  list = screen.find('FlatList');
  list.props.onContentSizeChange(1100, 3200);
  assert.equal(screen.scrollOffsets.length, afterGrowRequestCount, 'content from the prior size cannot finish a newer resize');
  list.props.onContentSizeChange(1100, 2800);
  assert.equal(screen.scrollOffsets.at(-1), 2100, 'the newest size receives the final alignment request');
  offset(screen, screen.boundedOffset());
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-4');
  screen.blur(); screen.commit();
});

test('a resize at the first card releases the alignment lock without waiting for an unnecessary scroll event', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen, 3);
  const beforeResizeRequests = screen.scrollOffsets.length;
  let feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  feed.props.onLayout({ nativeEvent: { layout: { height: 800 } } }); screen.commit();
  const list = screen.find('FlatList');
  feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  assert.equal(feed.props.onMoveShouldSetPanResponder({}, { dx: 0, dy: -40 }), false, 'input waits while the new content is unmeasured');
  screen.dispatchWheel({ deltaX: 0, deltaY: 120, deltaMode: 0, target: null });
  assert.equal(screen.scrollOffsets.length, beforeResizeRequests, 'wheel input cannot navigate during alignment');
  list.props.onContentSizeChange(1100, 2400);
  assert.equal(screen.scrollOffsets.length, beforeResizeRequests, 'offset zero needs no scroll request');
  feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  assert.equal(feed.props.onMoveShouldSetPanResponder({}, { dx: 0, dy: -40 }), true, 'the first card unlocks after content measurement');
  screen.blur(); screen.commit();
});

test('a resize with the actual committed offset refreshes the requested drag origin', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'ios'); await loadScreen(screen, 3);
  const next = drag(screen);
  next.move(-300); next.release(-300); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');

  const interrupted = drag(screen);
  interrupted.move(100);
  offset(screen, 500);
  const feed = screen.nodes(screen.find('Page')).find((node) => node.type === 'View' && node.props.onLayout)!;
  feed.props.onLayout({ nativeEvent: { layout: { height: 600 } } }); screen.commit();
  offset(screen, 600);
  screen.find('FlatList').props.onContentSizeChange(1100, 1800);
  const afterResize = drag(screen);
  afterResize.move(-20);
  assert.equal(screen.scrollOffsets.at(-1), 620, 'the next drag starts from the committed card offset');
  screen.blur(); screen.commit();
});

test('web wheel leaves horizontal and interactive targets alone', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen, 2);
  const horizontal: any = { deltaX: 40, deltaY: 10, deltaMode: 0, target: null };
  screen.dispatchWheel(horizontal);
  assert.equal(horizontal.prevented, undefined);
  const interactive: any = { deltaX: 0, deltaY: 200, deltaMode: 0, target: screen.element(true) };
  screen.dispatchWheel(interactive);
  assert.equal(interactive.prevented, undefined);
  assert.equal(screen.scrollOffsets.length, 0);
  screen.blur(); screen.commit();
});

test('an animation can finish before the wheel quiet timer without admitting its inertia tail', async () => {
  const screen = createRecommendationScreenHarness('readyToPlay', 'web'); await loadScreen(screen, 3);
  screen.dispatchWheel({ deltaX: 0, deltaY: 110, deltaMode: 0, target: null });
  frames(screen);
  offset(screen, 500);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2');
  const feed = screen.nodes(screen.find('Page')).find((n) => n.type === 'View' && n.props.onLayout)!.props;
  assert.equal(feed.onMoveShouldSetPanResponder({}, { dx: 0, dy: -40 }), false, 'the wheel burst also blocks a drag during its tail');
  screen.dispatchWheel({ deltaX: 0, deltaY: 120, deltaMode: 0, target: null });
  assert.equal(screen.frames.size, 0, 'tail input cannot queue another page after motion finishes');
  quiet(screen);
  screen.dispatchWheel({ deltaX: 0, deltaY: 110, deltaMode: 0, target: null });
  assert.ok(screen.frames.size, 'an independent input starts immediately after 150ms of quiet');
  frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-3');
  screen.blur(); screen.commit();
});

test('an unready or failed preview does not block the following gesture', async () => {
  const screen = createRecommendationScreenHarness('idle'); await loadScreen(screen, 3, false);
  const first = drag(screen); first.move(-300); offset(screen, 300); first.release(-250); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-2', 'navigation does not wait for video readiness');
  screen.pending[1].task.reject(new Error('preview unavailable'));
  await flush(); screen.commit();
  assert.equal(screen.find('FlatList').props.extraData.activeEntry.kind, 'unavailable');
  const next = drag(screen); next.move(-500); offset(screen, 1000); next.release(-500); frames(screen, true);
  assert.equal(screen.find('FlatList').props.extraData.activeId, 'drama-3', 'a failed preview can be skipped on a later input');
  screen.blur(); screen.commit();
});
