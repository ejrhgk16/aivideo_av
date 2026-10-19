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

export function resolveApiImageUrl(url: string | null): string | null {
  if (url === null) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to resolve API image URLs.');
  }

  return new URL(url, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

export function resolveVideoUrl(key: string): string {
  return resolveMediaUrl(process.env.EXPO_PUBLIC_VIDEO_BASE_URL, key, 'EXPO_PUBLIC_VIDEO_BASE_URL');
}

export { joinMediaUrl };
