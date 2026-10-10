export type MediaKind = 'image' | 'video';

function joinMediaUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
}

function resolveMediaUrl(baseUrl: string | undefined, key: string, envName: string): string {
  if (!baseUrl) {
    throw new Error(`${envName} must be set to resolve media files.`);
  }

  return joinMediaUrl(baseUrl, key);
}

export function resolveImageUrl(key: string): string {
  return resolveMediaUrl(process.env.EXPO_PUBLIC_IMAGE_BASE_URL, key, 'EXPO_PUBLIC_IMAGE_BASE_URL');
}

export function resolveVideoUrl(key: string): string {
  return resolveMediaUrl(process.env.EXPO_PUBLIC_VIDEO_BASE_URL, key, 'EXPO_PUBLIC_VIDEO_BASE_URL');
}

export { joinMediaUrl };
