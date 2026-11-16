export interface RecommendationPreviewTarget {
  dramaId: string;
  videoId: string;
}

export interface RecommendationPreviewPlayer {
  currentTime: number;
  status: string;
  pause(): void;
  play(): void;
  release(): void;
  addListener(name: 'statusChange', listener: (event: { status: string }) => void): { remove(): void };
}

export interface RecommendationPreviewEntry<P extends RecommendationPreviewPlayer> {
  target: RecommendationPreviewTarget;
  kind: 'loading' | 'ready' | 'unavailable';
  player?: P;
  resetWhenReady?: boolean;
  resetSubscription?: { remove(): void };
  subscriptions: Set<{ remove(): void }>;
}

export const recommendationPreviewKey = (target: RecommendationPreviewTarget) =>
  JSON.stringify([target.dramaId, target.videoId]);

export function createRecommendationPreviewBuffer<P extends RecommendationPreviewPlayer>(
  load: (dramaId: string, videoId: string) => Promise<{ url: string }>,
  create: (url: string) => P,
  changed: () => void,
) {
  const entries = new Map<string, RecommendationPreviewEntry<P>>();
  const inFlight = new Map<string, Promise<{ url: string }>>();
  const listeners = new Set<() => void>();
  const pendingRelease = new Set<P>();
  const released = new WeakSet<P>();
  let disposed = false;
  let finalized = false;

  const release = (player: P) => {
    if (released.has(player)) return;
    released.add(player);
    player.release();
  };

  const applyReset = (entry: RecommendationPreviewEntry<P>, player: P, status: string) => {
    if (!entry.resetWhenReady || entry.player !== player) return;
    if (status === 'readyToPlay') {
      player.currentTime = 0;
      entry.resetWhenReady = false;
      entry.resetSubscription?.remove();
      entry.resetSubscription = undefined;
    } else if (status === 'error') {
      entry.resetSubscription?.remove();
      entry.resetSubscription = undefined;
    }
  };

  const deferReset = (entry: RecommendationPreviewEntry<P>, player: P) => {
    if (entry.resetSubscription) return;
    const subscription = trackSubscription(entry.target, player, player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' || status === 'error') applyReset(entry, player, status);
    }));
    entry.resetSubscription = subscription;
    applyReset(entry, player, player.status);
  };

  const notify = () => {
    changed();
    for (const listener of listeners) listener();
  };

  function loadOnce(target: RecommendationPreviewTarget) {
    const key = recommendationPreviewKey(target);
    const existing = inFlight.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(() => {
      if (disposed) throw new Error('Recommendation preview buffer was disposed');
      return load(target.dramaId, target.videoId);
    });
    inFlight.set(key, request);
    const clear = () => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    };
    void request.then(clear, clear);
    return request;
  }

  function retain(targets: RecommendationPreviewTarget[]) {
    if (disposed) return;
    const boundedTargets = targets.slice(0, 3);
    const keep = new Set(boundedTargets.map(recommendationPreviewKey));
    for (const [key, entry] of entries) {
      if (keep.has(key)) continue;
      entries.delete(key);
      entry.player?.pause();
      for (const subscription of entry.subscriptions) subscription.remove();
      entry.subscriptions.clear();
      entry.resetSubscription = undefined;
      if (entry.player) pendingRelease.add(entry.player);
    }
    for (const target of boundedTargets) {
      const key = recommendationPreviewKey(target);
      if (entries.has(key)) continue;
      const entry: RecommendationPreviewEntry<P> = { target, kind: 'loading', subscriptions: new Set() };
      entries.set(key, entry);
      void loadOnce(target).then(({ url }) => {
        if (disposed || entries.get(key) !== entry) return;
        entry.player = create(url);
        if (entry.resetWhenReady) deferReset(entry, entry.player);
        entry.kind = 'ready';
        notify();
      }).catch(() => {
        if (disposed || entries.get(key) !== entry) return;
        entry.kind = 'unavailable';
        notify();
      });
    }
    notify();
  }

  function get(target: RecommendationPreviewTarget) {
    return entries.get(recommendationPreviewKey(target));
  }

  function pauseAll() {
    for (const entry of entries.values()) entry.player?.pause();
  }

  function resetToBeginning(target: RecommendationPreviewTarget) {
    const entry = get(target);
    if (!entry) return;
    entry.resetWhenReady = true;
    if (!entry.player) return;
    entry.player.pause();
    deferReset(entry, entry.player);
  }

  function setUnavailable(target: RecommendationPreviewTarget, player: P) {
    const entry = get(target);
    if (disposed || !entry || entry.player !== player) return;
    player.pause();
    entry.kind = 'unavailable';
    notify();
  }

  function trackSubscription(target: RecommendationPreviewTarget, player: P, subscription: { remove(): void }) {
    const entry = get(target);
    if (!entry || entry.player !== player || disposed) {
      subscription.remove();
      return { remove() {} };
    }
    let active = true;
    const tracked = {
      remove() {
        if (!active) return;
        active = false;
        subscription.remove();
        entry.subscriptions.delete(tracked);
      },
    };
    entry.subscriptions.add(tracked);
    return tracked;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function dispose() {
    if (finalized) return;
    finalized = true;
    disposed = true;
    for (const entry of entries.values()) {
      entry.player?.pause();
      for (const subscription of entry.subscriptions) subscription.remove();
      entry.subscriptions.clear();
      entry.resetSubscription = undefined;
      if (entry.player) release(entry.player);
    }
    for (const player of pendingRelease) release(player);
    pendingRelease.clear();
    entries.clear();
    inFlight.clear();
    listeners.clear();
  }

  function invalidate() {
    disposed = true;
    inFlight.clear();
  }

  return {
    retain,
    get,
    pauseAll,
    setUnavailable,
    trackSubscription,
    subscribe,
    dispose,
    invalidate,
    snapshot: () => [...entries.values()],
    releasePending() {
      for (const player of pendingRelease) release(player);
      pendingRelease.clear();
    },
    resetToBeginning,
  };
}
