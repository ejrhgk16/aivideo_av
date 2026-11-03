export const suites = [
  { id: 'http', collection: 'http.postman_collection.json', contentMode: 'shared' },
  { id: 'identity', collection: 'identity.postman_collection.json', contentMode: 'shared' },
  { id: 'content', collection: 'content.postman_collection.json', contentMode: 'shared' },
  { id: 'programming', collection: 'programming.postman_collection.json', contentMode: 'shared' },
  { id: 'playback', collection: 'playback.postman_collection.json', contentMode: 'shared' },
  { id: 'economy', collection: 'economy.postman_collection.json', contentMode: 'shared' },
  { id: 'watch-progress', collection: 'watch-progress.postman_collection.json', contentMode: 'shared' },
  { id: 'saved-videos', collection: 'saved-videos.postman_collection.json', contentMode: 'exclusive' },
  { id: 'watch-history', collection: 'watch-history.postman_collection.json', contentMode: 'exclusive' },
];

const suiteById = new Map(suites.map(suite => [suite.id, suite]));

export function selectSuites(args) {
  if (args.length === 0) return suites;
  const selected = new Set();
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== '--suite' || !args[index + 1] || !suiteById.has(args[index + 1])) {
      throw new Error('Expected --suite followed by a known API suite');
    }
    selected.add(args[index + 1]);
  }
  return suites.filter(suite => selected.has(suite.id));
}

export function parseSuiteArguments(args) {
  const suiteArgs = [];
  const postmanArgs = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--suite') {
      suiteArgs.push(args[index], args[index + 1]);
      index += 1;
    } else {
      postmanArgs.push(args[index]);
    }
  }
  return { suites: selectSuites(suiteArgs), postmanArgs };
}

