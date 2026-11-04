import { describe, expect, it, vi } from 'vitest';
import { readCatalogPages } from '../../api/catalogPages.mjs';

const item = (uuid: string) => ({ uuid });
const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });

describe('readCatalogPages', () => {
  it('reads pages in order and rejects duplicate UUIDs', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ items: Array.from({ length: 30 }, (_, index) => item(String(index))), page: 1, hasNext: true }))
      .mockResolvedValueOnce(response({ items: [item('30')], page: 2, hasNext: false }));
    await expect(readCatalogPages('http://localhost:3000/', fetcher as never)).resolves.toHaveLength(31);
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      'http://localhost:3000/dramas?sort=latest&page=1',
      'http://localhost:3000/dramas?sort=latest&page=2',
    ]);
    const duplicate = vi.fn().mockResolvedValue(response({ items: [item('0')], page: 2, hasNext: false }));
    const first = vi.fn().mockResolvedValue(response({
      items: Array.from({ length: 30 }, (_, index) => item(String(index))), page: 1, hasNext: true,
    }));
    await expect(readCatalogPages('http://localhost:3000', vi.fn().mockImplementationOnce(first).mockImplementationOnce(duplicate)))
      .rejects.toThrow('Invalid or duplicate catalog item');
  });

  it.each([
    [response({}, true), 'Invalid catalog page'],
    [response({ items: [], page: 2, hasNext: false }), 'Invalid catalog page'],
    [response({ items: [], page: 1, hasNext: 'false' }), 'Invalid catalog page'],
    [response({ items: Array.from({ length: 31 }, (_, index) => item(String(index))), page: 1, hasNext: false }), 'Invalid catalog page'],
    [response({ items: [item('one')], page: 1, hasNext: true }), 'Invalid catalog page'],
    [response({}, false, 503), 'Catalog HTTP request failed'],
  ])('rejects invalid response: %s', async (result, message) => {
    await expect(readCatalogPages('http://localhost:3000', vi.fn().mockResolvedValue(result) as never)).rejects.toThrow(message as string);
  });
});
