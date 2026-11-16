import { useEffect, useState } from 'react';
import { getSubtitleText, parseSubtitles, type SubtitleCue } from './subtitles';
import type { PlaybackSubtitle } from './playbackResponses';

type LoadedSubtitle = {
  key: string;
  status: 'loading' | 'ready' | 'error';
  cues: SubtitleCue[];
};

function getSubtitleKey(subtitle: PlaybackSubtitle): string {
  return JSON.stringify([subtitle.url, subtitle.format, subtitle.languageCode]);
}

export function useEpisodeSubtitles(
  subtitle: PlaybackSubtitle | null | undefined,
  enabled: boolean,
  positionMs: number,
): { status: 'unavailable' | 'loading' | 'ready' | 'error'; text: string } {
  const [loaded, setLoaded] = useState<LoadedSubtitle | null>(null);
  const key = subtitle ? getSubtitleKey(subtitle) : null;

  useEffect(() => {
    if (!subtitle) {
      setLoaded(null);
      return;
    }

    const requestKey = getSubtitleKey(subtitle);
    const controller = new AbortController();
    let active = true;
    setLoaded({ key: requestKey, status: 'loading', cues: [] });

    void (async () => {
      try {
        const response = await fetch(subtitle.url, { signal: controller.signal });
        if (!response.ok) throw new Error('Subtitle request failed');

        const cues = parseSubtitles(await response.text(), subtitle.format);
        if (cues.length === 0) throw new Error('Subtitle file has no valid cues');

        if (active) setLoaded({ key: requestKey, status: 'ready', cues });
      } catch {
        if (active) setLoaded({ key: requestKey, status: 'error', cues: [] });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [subtitle?.url, subtitle?.format, subtitle?.languageCode]);

  if (!subtitle) return { status: 'unavailable', text: '' };
  if (!loaded || loaded.key !== key) return { status: 'loading', text: '' };

  return {
    status: loaded.status,
    text: enabled && loaded.status === 'ready' ? getSubtitleText(loaded.cues, positionMs) : '',
  };
}
