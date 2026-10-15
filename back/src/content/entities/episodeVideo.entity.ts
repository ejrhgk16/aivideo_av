import { ContentVideo } from './contentVideo.entity.js';

/**
 * Transitional alias for modules that still use the pre-polymorphic media
 * name. The entity metadata is owned by ContentVideo so this does not add a
 * second table to the registry.
 */
export { ContentVideo as EpisodeVideo };

declare module './contentVideo.entity.js' {
  interface ContentVideo {
    /** @deprecated Use contentId with contentType = 'EPISODE'. */
    episodeId: string;
    /** @deprecated Video thumbnails are managed by content_images. */
    thumbnailKey?: string | null;
  }
}
