import { ContentImage } from './contentImage.entity.js';

/**
 * Transitional alias for modules that still use the pre-polymorphic media
 * name. The entity metadata is owned by ContentImage so this does not add a
 * second table to the registry.
 */
export { ContentImage as DramaImage };

declare module './contentImage.entity.js' {
  interface ContentImage {
    /** @deprecated Use contentId with contentType = 'DRAMA'. */
    dramaId: string;
  }
}
