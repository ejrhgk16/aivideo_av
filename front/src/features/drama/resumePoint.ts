import type { DramaContent } from './dramaContent';

type Episode = DramaContent['episodes'][number];
export type ResumePoint = { label: string; episode: Episode };

/** 작품의 시작·이어보기 주 버튼이 가리키는 회차와 문구. 버튼 문구와 눌렀을 때 여는 회차는 늘 같다. */
export function resumePoint(content: DramaContent): ResumePoint | null {
  const episodes = [...content.episodes].sort((first, second) => first.episodeNumber - second.episodeNumber);
  if (episodes.length === 0) return null;
  const watched = episodes.filter((episode) => episode.watchProgress !== null)
    .sort((first, second) => Date.parse(second.watchProgress!.lastPlayedAt) - Date.parse(first.watchProgress!.lastPlayedAt))[0];
  if (!watched) {
    const first = episodes[0];
    return { episode: first, label: first.pricePoints === 0 ? `${first.episodeNumber}화 무료로 보기` : `${first.episodeNumber}화 보기` };
  }
  if (!watched.watchProgress!.isCompleted) return { episode: watched, label: `${watched.episodeNumber}화 이어보기` };
  const next = episodes[episodes.indexOf(watched) + 1];
  return next ? { episode: next, label: `${next.episodeNumber}화 보기` } : { episode: watched, label: `${watched.episodeNumber}화 다시 보기` };
}

/** 주 버튼 문구. 작품 상세를 불러오는 동안은 목록의 무료 회차 수로 짐작하고, 회차를 정할 수 없으면 작품 소개로 보낸다. */
export function resumeLabel(resume: ResumePoint | null, freeEpisodeCount: number, loading: boolean): string {
  return resume?.label ?? (loading ? (freeEpisodeCount > 0 ? '1화 무료로 보기' : '1화 보기') : '작품 소개 보기');
}
