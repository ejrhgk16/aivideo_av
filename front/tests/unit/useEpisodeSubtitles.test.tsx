import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PlaybackSubtitle } from '../../src/features/playback/playbackResponses';
import { useEpisodeSubtitles } from '../../src/features/playback/useEpisodeSubtitles';

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(ok: boolean, text: () => Promise<string> = async () => '') {
  return { ok, text } as Response;
}

const koTrack: PlaybackSubtitle = {
  languageCode: 'ko',
  format: 'VTT',
  url: 'https://signed.example.com/ko.vtt',
};

const enTrack: PlaybackSubtitle = {
  languageCode: 'en',
  format: 'SRT',
  url: 'https://signed.example.com/en.srt',
};

const vtt = 'WEBVTT\n\n00:01.000 --> 00:03.000\n안녕하세요';
const srt = '1\n00:00:01,000 --> 00:00:03,000\nHello';

let originalFetch: typeof fetch;
let fetchMock: jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('returns unavailable without requesting when there is no selected subtitle', () => {
  const { result } = renderHook(() => useEpisodeSubtitles(undefined, true, 1500));

  expect(result.current).toEqual({ status: 'unavailable', text: '' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([
  ['VTT', koTrack, vtt, '안녕하세요'],
  ['SRT', enTrack, srt, 'Hello'],
] as const)('loads %s cues and selects text at the current position', async (_format, track, source, text) => {
  fetchMock.mockResolvedValueOnce(response(true, async () => source));

  const { result } = renderHook(() => useEpisodeSubtitles(track, true, 1500));

  await waitFor(() => expect(result.current).toEqual({ status: 'ready', text }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(track.url, { signal: expect.any(AbortSignal) });
});

test('fetches the subtitle file without adding app authorization headers', async () => {
  fetchMock.mockResolvedValueOnce(response(true, async () => vtt));

  renderHook(() => useEpisodeSubtitles(koTrack, true, 1500));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [, init] = fetchMock.mock.calls[0];
  expect(init?.headers).toBeUndefined();
});

test.each([
  ['an HTTP error', response(false, async () => vtt)],
  ['a body read error', response(true, async () => { throw new Error('body failed'); })],
  ['a file with no valid cues', response(true, async () => 'WEBVTT\n\ninvalid cue')],
])('reports an error for %s', async (_failure, failedResponse) => {
  fetchMock.mockResolvedValueOnce(failedResponse);

  const { result } = renderHook(() => useEpisodeSubtitles(koTrack, true, 1500));

  await waitFor(() => expect(result.current).toEqual({ status: 'error', text: '' }));
});

test('loads while disabled and updates text with enabled and position changes without refetching', async () => {
  fetchMock.mockResolvedValueOnce(response(true, async () =>
    'WEBVTT\n\n00:01.000 --> 00:02.000\nFirst\n\n00:02.000 --> 00:04.000\nSecond',
  ));

  const { result, rerender } = renderHook(
    ({ enabled, positionMs }: { enabled: boolean; positionMs: number }) =>
      useEpisodeSubtitles(koTrack, enabled, positionMs),
    { initialProps: { enabled: false, positionMs: 1500 } },
  );

  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.text).toBe('');

  rerender({ enabled: true, positionMs: 2500 });
  expect(result.current).toEqual({ status: 'ready', text: 'Second' });
  rerender({ enabled: true, positionMs: 4000 });
  expect(result.current).toEqual({ status: 'ready', text: '' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('refetches when the language or format changes even when the URL is unchanged', async () => {
  fetchMock
    .mockResolvedValueOnce(response(true, async () => vtt))
    .mockResolvedValueOnce(response(true, async () => 'WEBVTT\n\n00:01.000 --> 00:03.000\nEnglish'))
    .mockResolvedValueOnce(response(true, async () => '1\n00:00:01,000 --> 00:00:03,000\nEnglish SRT'));

  const { result, rerender } = renderHook(
    ({ track }: { track: PlaybackSubtitle }) => useEpisodeSubtitles(track, true, 1500),
    { initialProps: { track: koTrack } },
  );
  await waitFor(() => expect(result.current.text).toBe('안녕하세요'));

  const englishVtt = { ...koTrack, languageCode: 'en' };
  rerender({ track: englishVtt });
  await waitFor(() => expect(result.current.text).toBe('English'));

  const englishSrt = { ...englishVtt, format: 'SRT' as const };
  rerender({ track: englishSrt });
  await waitFor(() => expect(result.current.text).toBe('English SRT'));
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test('clears old text and aborts its request when the selected subtitle changes', async () => {
  const oldRequest = deferred<Response>();
  fetchMock.mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce(response(true, async () => srt));

  const { result, rerender } = renderHook(
    ({ track }: { track: PlaybackSubtitle }) => useEpisodeSubtitles(track, true, 1500),
    { initialProps: { track: koTrack } },
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const oldSignal = fetchMock.mock.calls[0][1]?.signal;
  expect(result.current).toEqual({ status: 'loading', text: '' });

  rerender({ track: enTrack });
  expect(result.current).toEqual({ status: 'loading', text: '' });
  await waitFor(() => expect(result.current).toEqual({ status: 'ready', text: 'Hello' }));
  expect(oldSignal?.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('keeps the new language when an aborted older request resolves late', async () => {
  const oldRequest = deferred<Response>();
  fetchMock.mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce(response(true, async () => srt));

  const { result, rerender } = renderHook(
    ({ track }: { track: PlaybackSubtitle }) => useEpisodeSubtitles(track, true, 1500),
    { initialProps: { track: koTrack } },
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  rerender({ track: enTrack });
  await waitFor(() => expect(result.current).toEqual({ status: 'ready', text: 'Hello' }));

  await act(async () => {
    oldRequest.resolve(response(true, async () => vtt));
    await oldRequest.promise;
  });
  expect(result.current).toEqual({ status: 'ready', text: 'Hello' });
});

test('aborts the pending request on unmount and ignores its later rejection', async () => {
  const request = deferred<Response>();
  fetchMock.mockReturnValueOnce(request.promise);

  const { unmount } = renderHook(() => useEpisodeSubtitles(koTrack, true, 1500));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const signal = fetchMock.mock.calls[0][1]?.signal;

  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    request.reject(new Error('late network failure'));
    await request.promise.catch(() => undefined);
  });
});
