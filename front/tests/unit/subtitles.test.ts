import { getSubtitleText, parseSubtitles } from '@/features/playback/subtitles';

describe('parseSubtitles', () => {
  test('parses BOM and CRLF VTT with an optional cue identifier and timing settings', () => {
    const source = '\uFEFFWEBVTT\r\n\r\nopening\r\n00:01.000 --> 00:02.500 align:start position:10%\r\n첫 줄\r\n둘째 줄\r\n';

    expect(parseSubtitles(source, 'VTT')).toEqual([
      { startMs: 1000, endMs: 2500, text: '첫 줄\n둘째 줄' },
    ]);
  });

  test('parses VTT hour timestamps, strips style tags, and decodes basic entities', () => {
    const source = [
      'WEBVTT',
      '',
      '01:02:03.004 --> 01:02:05.006',
      '<v Narrator><b>A &amp; B</b> &lt;scene&gt;X&nbsp;Y&lrm;Z&rlm;</v>',
    ].join('\n');

    expect(parseSubtitles(source, 'VTT')).toEqual([
      { startMs: 3_723_004, endMs: 3_725_006, text: 'A & B <scene>X\u00a0Y\u200eZ\u200f' },
    ]);
  });

  test('ignores VTT NOTE, STYLE, and REGION blocks while keeping later cues', () => {
    const source = [
      'WEBVTT',
      '',
      'NOTE editor comment',
      '00:00.000 --> 00:01.000',
      'not a cue',
      '',
      'STYLE',
      '::cue { color: lime; }',
      '',
      'REGION',
      'id:bottom',
      '',
      '00:01.000 --> 00:02.000',
      'visible',
    ].join('\n');

    expect(parseSubtitles(source, 'VTT')).toEqual([
      { startMs: 1000, endMs: 2000, text: 'visible' },
    ]);
  });

  test('parses numbered SRT cues, comma milliseconds, and multiline text', () => {
    const source = [
      '1',
      '00:00:01,025 --> 00:00:03,400',
      '첫 줄',
      '둘째 줄',
      '',
      '2',
      '01:02:03,004 --> 01:02:04,005',
      '다음 장면',
    ].join('\r\n');

    expect(parseSubtitles(source, 'SRT')).toEqual([
      { startMs: 1025, endMs: 3400, text: '첫 줄\n둘째 줄' },
      { startMs: 3_723_004, endMs: 3_724_005, text: '다음 장면' },
    ]);
  });

  test('skips empty files, invalid times, reversed intervals, and empty cues without losing valid cues', () => {
    expect(parseSubtitles('', 'VTT')).toEqual([]);
    expect(parseSubtitles('WEBVTT\n\n', 'VTT')).toEqual([]);

    const source = [
      'WEBVTT',
      '',
      '00:60.000 --> 00:61.000',
      'minute out of range',
      '',
      '00:02.000 --> 00:01.000',
      'reversed',
      '',
      '00:03.000 --> 00:03.000',
      'zero length',
      '',
      '00:04.000 --> 00:05.000',
      '   ',
      '',
      '00:05.000 --> 00:06.000',
      'kept',
    ].join('\n');

    expect(parseSubtitles(source, 'VTT')).toEqual([
      { startMs: 5000, endMs: 6000, text: 'kept' },
    ]);
  });
});

describe('getSubtitleText', () => {
  const cues = parseSubtitles([
    'WEBVTT',
    '',
    '00:01.000 --> 00:03.000',
    'first',
    '',
    '00:02.000 --> 00:04.000',
    'second',
  ].join('\n'), 'VTT');

  test('includes the start, excludes the end, and joins overlapping cues in file order', () => {
    expect(getSubtitleText(cues, 1000)).toBe('first');
    expect(getSubtitleText(cues, 2000)).toBe('first\nsecond');
    expect(getSubtitleText(cues, 3000)).toBe('second');
    expect(getSubtitleText(cues, 4000)).toBe('');
  });

  test('returns no text in gaps or for negative and non-finite positions', () => {
    expect(getSubtitleText(cues, 0)).toBe('');
    expect(getSubtitleText(cues, -1)).toBe('');
    expect(getSubtitleText(cues, Number.NaN)).toBe('');
    expect(getSubtitleText(cues, Number.POSITIVE_INFINITY)).toBe('');
  });

  test('supports seeking backward by selecting cues from the supplied position', () => {
    expect(getSubtitleText(cues, 3500)).toBe('second');
    expect(getSubtitleText(cues, 1500)).toBe('first');
  });
});
