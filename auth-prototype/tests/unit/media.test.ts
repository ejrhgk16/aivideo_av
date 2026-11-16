import { resolveApiImageUrl } from '../../src/common/media';

test('relative API image paths resolve against the API base URL', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';

  try {
    expect(resolveApiImageUrl('/media/images/dramas/example.webp'))
      .toBe('http://localhost:3000/media/images/dramas/example.webp');
  } finally {
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('absolute API image URLs remain unchanged', () => {
  expect(resolveApiImageUrl('https://cdn.example.com/signed-image.webp?token=abc'))
    .toBe('https://cdn.example.com/signed-image.webp?token=abc');
});

test('null API image URLs remain null without requiring an API base URL', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;

  try {
    expect(resolveApiImageUrl(null)).toBeNull();
  } finally {
    if (originalBaseUrl !== undefined) process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

