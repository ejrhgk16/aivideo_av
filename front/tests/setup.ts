const { TextDecoder, TextEncoder } = require('node:util');
const { clearImmediate, setImmediate } = require('node:timers');
if (typeof globalThis.TextEncoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
}
if (typeof globalThis.TextDecoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: TextDecoder });
}
if (typeof globalThis.setImmediate === 'undefined') {
  Object.defineProperty(globalThis, 'setImmediate', { configurable: true, value: setImmediate });
}
if (typeof globalThis.clearImmediate === 'undefined') {
  Object.defineProperty(globalThis, 'clearImmediate', { configurable: true, value: clearImmediate });
}

const { cleanup } = require('@testing-library/react-native');
const { resetMockVideoPlayers } = require('./support/video');

jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockFeather() {
    return React.createElement(Text);
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  const { createMockVideoPlayer } = require('./support/video');

  return {
    createVideoPlayer: (source: string | { uri?: string } | null) =>
      createMockVideoPlayer(typeof source === 'string' ? source : source?.uri),
    useVideoPlayer(source: string | { uri?: string } | null, setup?: (player: any) => void) {
      const sourceKey = typeof source === 'string' ? source : JSON.stringify(source);
      const player = React.useMemo(
        () => createMockVideoPlayer(typeof source === 'string' ? source : source?.uri),
        [sourceKey],
      );
      const setupRef = React.useRef(setup);
      setupRef.current = setup;
      React.useEffect(() => {
        setupRef.current?.(player);
        return () => player.release();
      }, [player]);
      return player;
    },
    VideoView: ({ player: _player, ...props }: Record<string, unknown>) => React.createElement(View, props),
  };
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  resetMockVideoPlayers();
});
