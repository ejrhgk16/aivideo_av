# Backend API tests

Postman CLI tests call the existing NestJS development API over HTTP and verify its configured MySQL database. The runner never starts an API or switches ports. It fails when the target API or required development data is unavailable. Do not download signed media URLs.

## Running suites

Postman CLI must be installed and available on `PATH`. Local collection execution does not require a Postman login. The default target is `http://localhost:3000`.

```powershell
npm --prefix back run test:api
npm --prefix back run test:api -- --suite saved-videos
npm --prefix back run test:api -- --suite content --suite playback
```

With no `--suite`, all suites run once in this order: `http`, `identity`, `content`, `programming`, `playback`, `economy`, `watch-progress`, `saved-videos`. Repeated suite names are deduplicated. Unknown suites, missing values, and malformed selection fail before API or database changes. The default full run runs unit tests and all API suites through `npm --prefix back run test`.

| Suite | Scenarios migrated from the former public collection | Content lock |
| --- | --- | --- |
| `http` | Root response, allowed and rejected CORS origins, JWT preflights | shared |
| `identity` | Login validation; Refresh rotation, replay, concurrent rotation and revocation; logout; web-cookie CSRF, rotation and anonymous behavior | shared |
| `content` | Genres, catalog sorting, drama detail, ownership, and legacy `userUuid` spoofing | shared |
| `programming` | Four home collections, ordering, missing collection | shared |
| `playback` | Free, paid and preview playback; entitlement; malformed credentials, missing media and identity spoofing | shared |
| `economy` | Point increase, idempotency, insufficient balance, purchase and repeated purchase | shared |
| `watch-progress` | HTTP progress writes, UTC timestamps, completion threshold and retention | shared |
| `saved-videos` | Save/remove, pagination 0/30/31, tied timestamps, hidden content, user isolation and response flags | exclusive |

The eight suite collection files are the only request and assertion definitions; the former `public` collection is deleted. Each suite keeps the former collection's common response-shape assertion and checks exact keys for nested successful response objects. Internal `pm.sendRequest` calls must invoke the same contract assertions explicitly because collection-level events do not run for those responses. `suites.mjs` owns selection and lock mode. Each invocation copies its selected collection and environment into one temporary run directory. `test:api:parallel` runs two actual watch-progress suites with distinct run and user UUIDs, proves both own their HTTP-created rows, cleans the first while checking the second user's rows remain, then verifies both have no residual rows or users. It also holds a content reader after its HTTP suite, proves a saved-videos writer waits for the exclusive lock, then releases the reader and confirms the writer completes.

## Fixture behavior

The managed development mode loads `back/.env.development` or `back/.env`, requires explicit non-empty `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE`, and connects to the same development database as the API. Each applicable suite run creates two users with fresh UUIDs, login credentials, and wallets; `identity` needs only its users, while `http` and `programming` need no user or database fixtures. The entitled user receives a temporary grant for an existing public paid episode; both users' progress and saved rows are scoped to their new user IDs. It discovers public catalog, drama, episode and media IDs from the running API and fails when required public records are absent.

The `content` suite inserts its own baseline progress row. The `saved-videos` suite creates a published run-owned drama, links it to `HOME_FEATURED`, adds cloned drama images, run-owned preview videos, and separate free and paid FULL episodes; all saved PREVIEW and FULL boundary media belong to this fixture. Its saved PAID FULL video is verified as paid and unentitled before the collection runs. Publication-state fixtures are also run-owned. Saved-video setup and checks hold an exclusive content lock so readers cannot compare a changing catalog. Existing users, wallet balances, credentials, and saved rows are never changed.

Every allocated fixture UUID is recorded before insertion. Cleanup removes only owned progress pairs, saved user/video pairs and generated content, then removes the run's users after their refresh history, entitlements, saves, progress, point transactions and wallets. A preparation or assertion failure remains a failure even when cleanup also fails. The API's successful hidden-video DELETE is confirmed before its fixture is removed. Database credentials, passwords and JWTs are never printed or stored in collection files.

`API_TEST_ENVIRONMENT_FILE` selects an externally prepared Postman environment. This mode does not connect to MySQL or create, alter, or clean fixtures. It forwards Postman options and credentials as supplied, and takes an exclusive content lock for the environment's effective `baseUrl`, including a `--env-var baseUrl=...` override. Keep that environment outside Git. Never pass passwords as command-line arguments.

The `saved-videos` collection requires `savedLookupEpisodeUuid`, `savedLookupEpisodeVideoUuid`, and `savedPaidEpisodeUuid` alongside the existing `savedPaidVideoUuid`. The lookup video must be the FREE FULL for its lookup episode; `savedPaidVideoUuid` must be the PAID FULL for `savedPaidEpisodeUuid`, and both episodes must belong to the drama identified by `savedOtherUserVideoUuid`. The collection checks these UUID and price relationships against the drama detail before saving. External environments own fixture preparation and cleanup, including removing any save left behind by a failed collection run.

## Existing development data

For response contract changes, first run the selected eight API suites against the current server and record the old successful and custom business-error shapes. After response type annotations are added, rerun the relevant suites and compare against the same exact-key assertions. After global error handling changes, rerun all eight suites; only the documented ordinary Nest error cases may change to the shared error body. Never relax successful-response assertions to fit the new implementation. Do not save response captures containing access/refresh tokens, passwords, cookies, signed URLs, or other credentials; assert those values in memory and retain only non-secret pass/fail results.

For content and playback checks, `/genres` needs at least one row and `/dramas` at least two public dramas. One drama must have a preview, a free episode, and at least two paid episodes with FULL media; a third distinct public paid episode is needed for the purchase check. All four collection types (`HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY`, and `HOME_CAMPAIGN`) must be active; their drama arrays may be empty. Playback checks require development S3 signing configuration; tests inspect signed URL metadata without fetching the media object.

The economy checks use a separate public paid episode for purchase and the run's zero-balance user for the insufficient-balance response. Watch-progress selects a free public episode and an entitled paid episode from the API-visible fixture IDs. The database must not be edited by another test while catalog/detail/collection consistency checks run.

If port 3000 is unavailable, start the backend yourself from the repository root and rerun the check:

```powershell
npm --prefix back run start:dev
```

`npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`, and `npm --prefix back run test:api:parallel` are the backend verification commands. API connection failures, missing content, request timeouts, failed assertions, and cleanup failures are failed checks.
