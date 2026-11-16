export type MediaKind = 'image' | 'video';

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

