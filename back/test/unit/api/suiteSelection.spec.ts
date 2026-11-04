import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSuiteArguments, selectSuites, suites } from '../../api/suites.mjs';

const collectionDirectory = fileURLToPath(new URL('../../api/', import.meta.url));

describe('API suite selection', () => {
  it('registers all eleven suites in the default order', () => {
    expect(selectSuites([]).map(suite => suite.id)).toEqual([
      'http', 'identity', 'content', 'drama-pagination', 'programming', 'playback', 'economy', 'watch-progress', 'saved-videos', 'watch-history', 'point-history',
    ]);
  });

  it('runs drama-pagination under the exclusive content lock', () => {
    expect(selectSuites(['--suite', 'drama-pagination'])).toMatchObject([
      { id: 'drama-pagination', contentMode: 'exclusive', collection: 'drama-pagination.postman_collection.json' },
    ]);
  });

  it('selects requested suites once in canonical order', () => {
    expect(selectSuites(['--suite', 'watch-history', '--suite', 'content', '--suite', 'watch-history'])
      .map(suite => suite.id)).toEqual(['content', 'watch-history']);
  });

  it('runs watch-history under the exclusive content lock', () => {
    expect(selectSuites(['--suite', 'watch-history'])).toMatchObject([
      { id: 'watch-history', contentMode: 'exclusive', collection: 'watch-history.postman_collection.json' },
    ]);
  });

  it('selects point-history once and runs it under the exclusive content lock', () => {
    expect(selectSuites(['--suite', 'point-history', '--suite', 'point-history'])).toMatchObject([
      { id: 'point-history', contentMode: 'exclusive', collection: 'point-history.postman_collection.json' },
    ]);
  });

  it.each([['--suite'], ['--suite', ''], ['--suite', 'unknown'], ['--unknown']])(
    'rejects invalid selection %j before setup', (...args) => {
      expect(() => selectSuites(args as string[])).toThrow('Expected --suite');
    },
  );

  it('keeps Postman options separate from suite selection', () => {
    expect(parseSuiteArguments(['--suite', 'content', '--env-var', 'baseUrl=http://localhost:3000']))
      .toMatchObject({ suites: [{ id: 'content' }], postmanArgs: ['--env-var', 'baseUrl=http://localhost:3000'] });
  });

  it.each(suites.map(suite => [suite.id, suite] as const))('maps %s to its standalone static collection', (id, suite) => {
    const collection = JSON.parse(readFileSync(`${collectionDirectory}${suite.collection}`, 'utf8'));
    const names = collection.item.map((item: { name: string }) => item.name);
    expect(names).toContain('Root');
    expect(collection.item.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    if (!['http', 'identity', 'programming'].includes(id)) {
      expect(names).toContain('Login as entitled fixture user');
      expect(names).toContain('Login as unentitled fixture user');
    }
  });
});
