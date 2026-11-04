const PAGE_SIZE = 30;

/**
 * Read every page of the public catalog.
 * @param {string} baseUrl
 * @param {typeof fetch} fetcher
 * @returns {Promise<import('../../src/content/contentResponses.js').DramaSummaryResponse[]>}
 */
export async function readCatalogPages(baseUrl, fetcher = fetch) {
  const items = [];
  const seen = new Set();
  for (let page = 1; ; page += 1) {
    const url = `${baseUrl.replace(/\/+$/, '')}/dramas?sort=latest&page=${page}`;
    const response = await fetcher(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Catalog HTTP request failed with status ${response.status}.`);
    const body = await response.json();
    if (!body || !Array.isArray(body.items) || body.page !== page || typeof body.hasNext !== 'boolean' ||
        body.items.length > PAGE_SIZE || (body.hasNext && body.items.length !== PAGE_SIZE)) {
      throw new Error('Invalid catalog page.');
    }
    for (const item of body.items) {
      if (!item || typeof item.uuid !== 'string' || seen.has(item.uuid)) {
        throw new Error('Invalid or duplicate catalog item.');
      }
      seen.add(item.uuid);
      items.push(item);
    }
    if (!body.hasNext) return items;
  }
}
