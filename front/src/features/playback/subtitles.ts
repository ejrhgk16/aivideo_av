export type SubtitleCue = { startMs: number; endMs: number; text: string };

const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': '\u00a0',
  '&lrm;': '\u200e',
  '&rlm;': '\u200f',
};

function parseTimestamp(value: string, format: 'VTT' | 'SRT'): number | null {
  const match = format === 'SRT'
    ? value.match(/^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/)
    : value.match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/);

  if (!match) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);

  if (minutes >= 60 || seconds >= 60) return null;

  const result = ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
  return Number.isFinite(result) ? result : null;
}

function parseCueBlock(block: string, format: 'VTT' | 'SRT'): SubtitleCue | null {
  const lines = block.split('\n');
  const timingIndex = lines[0].includes('-->') ? 0 : lines[1]?.includes('-->') ? 1 : -1;
  if (timingIndex < 0) return null;

  const timing = lines[timingIndex].trim().match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
  if (!timing) return null;

  const startMs = parseTimestamp(timing[1], format);
  const endMs = parseTimestamp(timing[2], format);
  if (startMs === null || endMs === null || endMs <= startMs) return null;

  const text = lines.slice(timingIndex + 1)
    .join('\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|nbsp|lrm|rlm);/g, (entity) => entities[entity])
    .trim();

  return text ? { startMs, endMs, text } : null;
}

export function parseSubtitles(source: string, format: 'VTT' | 'SRT'): SubtitleCue[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const cues: SubtitleCue[] = [];

  for (const rawBlock of normalized.split(/\n[ \t]*\n/)) {
    const block = rawBlock.trim();
    if (!block) continue;

    const firstLine = block.split('\n', 1)[0];
    if (format === 'VTT' && /^(?:WEBVTT(?:[ \t]|$)|NOTE(?:[ \t]|$)|STYLE(?:[ \t]|$)|REGION(?:[ \t]|$))/.test(firstLine)) {
      continue;
    }

    const cue = parseCueBlock(block, format);
    if (cue) cues.push(cue);
  }

  return cues;
}

export function getSubtitleText(cues: readonly SubtitleCue[], positionMs: number): string {
  if (!Number.isFinite(positionMs) || positionMs < 0) return '';

  return cues
    .filter((cue) => cue.startMs <= positionMs && positionMs < cue.endMs)
    .map((cue) => cue.text)
    .join('\n');
}
