type VideoEvent =
  | 'timeUpdate'
  | 'statusChange'
  | 'playingChange'
  | 'sourceLoad'
  | 'playbackRateChange';

type Listener = (payload: any) => void;

export type MockVideoPlayer = {
  source: string | undefined;
  currentTime: number;
  duration: number;
  playbackRate: number;
  status: 'idle' | 'loading' | 'readyToPlay' | 'error';
  playing: boolean;
  timeUpdateEventInterval: number;
  play: jest.Mock<void, []>;
  pause: jest.Mock<void, []>;
  release: jest.Mock<void, []>;
  addListener(name: VideoEvent, listener: Listener): { remove(): void };
  emit(name: VideoEvent, payload: Record<string, unknown>): void;
  listenerCount(name: VideoEvent): number;
};

export const mockVideoPlayers: MockVideoPlayer[] = [];

export function createMockVideoPlayer(source?: string): MockVideoPlayer {
  const listeners = new Map<VideoEvent, Set<Listener>>();
  const player: MockVideoPlayer = {
    source,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    status: 'idle',
    playing: false,
    timeUpdateEventInterval: 0,
    play: jest.fn(() => player.emit('playingChange', { isPlaying: true })),
    pause: jest.fn(() => player.emit('playingChange', { isPlaying: false })),
    release: jest.fn(() => listeners.clear()),
    addListener(name, listener) {
      const current = listeners.get(name) ?? new Set<Listener>();
      current.add(listener);
      listeners.set(name, current);
      return { remove: () => { current.delete(listener); } };
    },
    emit(name, payload) {
      if (name === 'timeUpdate' && typeof payload.currentTime === 'number') player.currentTime = payload.currentTime;
      if (name === 'statusChange' && typeof payload.status === 'string') player.status = payload.status as MockVideoPlayer['status'];
      if (name === 'playingChange' && typeof payload.isPlaying === 'boolean') player.playing = payload.isPlaying;
      if (name === 'sourceLoad' && typeof payload.duration === 'number') player.duration = payload.duration;
      if (name === 'playbackRateChange' && typeof payload.playbackRate === 'number') player.playbackRate = payload.playbackRate;
      for (const listener of [...(listeners.get(name) ?? [])]) listener(payload);
    },
    listenerCount(name) {
      return listeners.get(name)?.size ?? 0;
    },
  };
  mockVideoPlayers.push(player);
  return player;
}

export function resetMockVideoPlayers(): void {
  for (const player of mockVideoPlayers) player.release();
  mockVideoPlayers.length = 0;
}
