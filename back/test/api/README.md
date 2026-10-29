# Backend API tests

Postman CLI calls the running NestJS API over HTTP. The API uses its configured, real MySQL database; repositories and database responses are not mocked. Tests may use GET, OPTIONS, POST, PUT, PATCH, DELETE, and other methods supported by the endpoints. Creating/resetting/seeding the development database and changing test data are allowed when needed for API verification. Tests do not download images/videos from signed URLs.

## Run

Postman CLI must be installed (`postman --version`). Local collection execution does not require a Postman login. Keep database and AWS credentials in the existing Git-ignored `back/.env.development`, not in the collection.

First check whether the existing development API responds over HTTP (default: `http://localhost:3000`). If a server is already running, confirm it reflects the current code and run tests against that server. Do not start an additional test server or switch ports when an existing server is running. An empty port/process lookup alone does not establish that no server exists. If current-code readiness cannot be confirmed, ask the user before proceeding.

If the backend is not running on port 3000, report an error and fail verification. Agents must not start the server automatically or use another port as a workaround. Print an instruction asking the user to start the backend from the repository root with the following command, then retry verification after it is running:

```powershell
npm --prefix back run start:dev
```

Wait for startup and ensure the server has recompiled the current code. In another terminal:

```powershell
npm --prefix back run test:api
```

The default API address is `http://localhost:3000`. To test another running development instance:

```powershell
$env:API_TEST_ENVIRONMENT_FILE = 'C:\path\to\local-postman-environment.json'
npm --prefix back run test:api -- --env-var baseUrl=http://localhost:3001
```

`test:api` runs `test/api/run.mjs`, so `npm run test` and Harness `finish` use the same credential forwarding. By default the runner loads the backend's `.env.development` / `.env`, checks the existing local API, and connects to that development MySQL database. It reads credentials for the two documented fixture users, assigns generated temporary credentials only when the unentitled fixture's login and password are both null, and forwards all four values through a temporary Postman environment file. Credentials are not printed or committed. After the run, it restores the temporary login, removes the environment file, and deletes only the two progress pairs proven absent before this run. Existing progress at either write-fixture pair fails setup for inspection rather than being deleted. Other fixture records and entitlements are not reset.

Set `API_TEST_ENVIRONMENT_FILE` to an existing local Postman environment file to use other credentials, fixture UUIDs, or a running API address. This explicit mode forwards the file and CLI arguments unchanged and does not connect to MySQL or prepare/clean fixtures. Prepare those fixtures yourself. The file must supply the four login variables below; keep it outside Git or under a Git-ignored path. The inherited variable also works when running Harness `finish`. Do not put passwords in command-line arguments. The collection does not use a cloud collection ID and disables event reporting.

`npm --prefix back run test` runs `test:unit` followed by `test:api`. Harness backend checks already call `test`, so workers and finish also run the real API checks. Server connection failures, request timeouts, missing required content, HTTP errors, and assertion failures fail the command. Do not report an unavailable API as a passing test.

## Existing data requirements

- `/genres` must return at least one genre.
- `/dramas` must return at least two public dramas. At least one must have a preview and both free and paid public episodes with FULL videos. The collection obtains their UUIDs from the responses; it does not hard-code seed UUIDs, titles, counts, or image paths.
- `HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY`, and `HOME_CAMPAIGN` must be active collections. Their drama arrays may be empty.
- Playback requires the existing development-only S3 signing configuration. Tests inspect the signed URL and its expiry; they do not request the S3 object or verify that the media object exists.
- Avoid editing the same content during a run: catalog/detail/collection consistency checks compare successive responses.

Tests may prepare the required development data through database setup, seeds, and data changes. If the requirements remain unmet, the run fails and reports the missing condition.

## Coverage

The identity requests check `POST /auth/login` with the seeded `admin` / `admin` credentials, token and response fields, incorrect credentials (401), and malformed input (400). The victim-first flow rotates twice before replaying the first token, then confirms a later request with the newest token is rejected after replay revocation commits. The attacker-first flow obtains the first rotation before the user retries the original token; replay then rejects the attacker's returned token. A pre-existing separate login remains usable after both replay and logout of the first login. Logout with both current and previously used tokens is checked, along with idempotent repeated logout and later refresh rejection. The collection also checks malformed and tampered tokens, an access token used as refresh, and two simultaneous requests with the same refresh token: exactly one must succeed, then the successful response token must fail because replay detection revoked the login. Tests retain auth session and token history rows and finish usable sessions by logging them out; they never store or print raw tokens as static fixtures.

Refresh history is append-only. Tests only create, rotate, and revoke sessions created by their own login requests. A replay's 401 is followed by another HTTP request to prove the revocation was committed rather than rolled back. The HTTP collection does not receive signing keys; a unit test signs a valid Refresh JWT with a local key but no matching history and verifies rejection before starting a transaction.

The collection first logs in as the entitled and unentitled fixture users using environment credentials and verifies that each login UUID matches its configured fixture. It then checks the root endpoint, genre/catalog response shapes and public UUIDs, default/invalid sort, detail/catalog consistency, public episode counts and ordering, anonymous and authenticated free playback, owned and denied paid playback, preview playback and ownership, missing-resource errors, four home collections and their ordering, and allowed/disallowed CORS origins and preflight. JWT preflights request both `authorization` and `content-type`. Legacy `userUuid` query values are tested to confirm they cannot select another user.

The collection checks unauthenticated `/me` requests, custom point errors including invalid input, missing episode, insufficient balance, and idempotency conflict. It then performs one minimal idempotent point increase and an actual purchase against the separately configured `purchaseTestEpisodeUuid`, repeating both operations to verify no second balance change or charge. This paid episode must be public and available in the development database; do not use `lockedEpisodeUuid`, since that fixture must remain unowned for the read-only authorization checks. The purchase test user must have enough points. These final mutation requests run after catalog, entitlement, and insufficient-balance checks. The insufficient-balance case requires a development test user `00000012-0000-4000-8000-000000000001` with an existing zero-point wallet. Prepare it in the configured development database with:

```sql
INSERT IGNORE INTO users
  (uuid, account_type, status, display_name, production_company_id)
VALUES
  ('00000012-0000-4000-8000-000000000001', 'MEMBER', 'ACTIVE', 'api-error-test', NULL);

INSERT IGNORE INTO wallets (user_id, available_points)
SELECT id, 0 FROM users
WHERE uuid = '00000012-0000-4000-8000-000000000001';
```

The key-conflict case uses the admin's seeded `seed:admin:initial-points:v1` key and makes no data change. The final idempotency and purchase checks mutate only their named development test records. API responses do not expose publication timestamps or all hidden records, so latest publication ordering and every hidden/scheduled-content boundary cannot be proven from these HTTP responses alone. Focused unit tests retain publication/environment/scheduling boundaries and internal database/seed/storage rules.

### Drama detail entitlement fixtures

The detail collection cases compare two users' entitlements. The UUID defaults below identify existing development fixtures. Login credentials and the isolated purchase test episode must be supplied through Postman environment variables or CLI arguments:

| Variable | Current development value | Purpose |
| --- | --- | --- |
| `entitledUserUuid` | `00000010-0000-4000-8000-000000000001` | Existing admin user with a paid entitlement |
| `unentitledUserUuid` | `00000012-0000-4000-8000-000000000001` | Existing user with no entitlement to the drama episodes |
| `entitledLoginId` / `entitledPassword` | supplied in Postman environment | Credentials for the existing entitled user |
| `unentitledLoginId` / `unentitledPassword` | supplied in Postman environment | Credentials for the existing unentitled user |
| `purchaseTestEpisodeUuid` | `00000004-0000-4000-8000-000000000004` | Separate public paid episode used only by the final purchase mutation check |
| `entitlementDramaUuid` | `00000002-0000-4000-8000-000000000001` | Drama containing the fixture episodes |
| `entitledEpisodeUuid` | `00000004-0000-4000-8000-000000000002` | Paid episode owned by the first user |
| `lockedEpisodeUuid` | `00000004-0000-4000-8000-000000000003` | Paid episode owned by neither user |

The current DB was inspected using SELECT statements only. The same drama also contains a free episode (`00000004-0000-4000-8000-000000000001`). If local development data differs, set equivalent IDs for existing users, drama, and episodes in the Postman environment. The API collection must not create an entitlement or change point balances to prepare these cases.

The playback checks reuse these fixtures: the entitled user can play `entitledEpisodeUuid`, while the unentitled user's JWT receives the custom 403 even when its request spoofs the entitled UUID in a legacy query. Anonymous playback of the public paid episode returns `AUTH_INVALID_TOKEN`(401). Both users and an anonymous request can play the free episode. `lockedEpisodeUuid` verifies that entitlement to one episode does not unlock another episode. Read checks do not mutate entitlements.

The default local runner supplies the four login variables automatically from the existing development fixtures. For a custom environment, provide them in `API_TEST_ENVIRONMENT_FILE`. Never put passwords in the collection. The current default fixture UUIDs require logins to return those exact UUIDs. The development setup may temporarily assign a generated test login to the existing unentitled fixture user when both its `login_id` and `password` are null; the test runner restores them to null afterward. It does not overwrite an existing unrelated login, reset the database, or create entitlements to make read tests pass. The configured purchase episode is separate from the read-only entitlement fixtures and has a price within the existing admin balance. Test sessions are logged out at the end of the collection.

To pass credentials and override fixture values, supply Postman environment values. Keep credential values in your local shell or Postman environment and do not commit or print them:

```powershell
$env:API_TEST_ENVIRONMENT_FILE = 'C:\path\to\local-postman-environment.json'
npm --prefix back run test
```

The detail checks verify the owned paid episode is unlocked only for its owner, another paid episode stays locked, free episodes are unlocked for both users, and anonymous requests expose no stored entitlement. Playback separately requires a matching entitlement for paid episodes; anonymous access remains valid for free episodes and previews.

The drama detail collection requires one watch-progress fixture for the entitled user. It compares the response with `watchProgressEpisodeUuid`, `watchProgressPositionMs`, `watchProgressIsCompleted`, and `watchProgressLastPlayedAt`; the same episode must return `watchProgress: null` for the unentitled user and for anonymous requests. Defaults match the development fixture below. If local UUIDs differ, set these variables to equivalent records in the Postman environment.

The collection also writes progress through `PUT /me/episodes/:episodeUuid/watch-progress`. It uses the unentitled fixture user with the selected free episode and the entitled fixture user with `entitledEpisodeUuid`; these pairs are separate from the read-only progress fixture above. Before each full API test run, inspect and remove only rows owned by those two test pairs so the collection can prove a new row is inserted. The selected free episode comes from the public catalog response. `entitledEpisodeUuid` must remain public, purchased by the entitled fixture user, and have a FULL video. Do not remove the existing admin/locked-episode read fixture or any other user's progress.

Inspect the exact rows before cleanup:

```sql
SELECT u.uuid AS userUuid, e.uuid AS episodeUuid, p.position_ms, p.is_completed,
       p.created_at, p.updated_at
FROM user_watch_progress p
JOIN users u ON u.id = p.user_id
JOIN episodes e ON e.id = p.episode_id
WHERE (u.uuid = '00000012-0000-4000-8000-000000000001' AND e.uuid = '<current-free-episode-uuid>')
   OR (u.uuid = '00000010-0000-4000-8000-000000000001' AND e.uuid = '00000004-0000-4000-8000-000000000002');
```

If either row exists from a previous run, delete only these test-owned composite-key rows before rerunning (substitute the free episode UUID printed by the catalog):

```sql
DELETE p FROM user_watch_progress p
JOIN users u ON u.id = p.user_id
JOIN episodes e ON e.id = p.episode_id
WHERE (u.uuid = '00000012-0000-4000-8000-000000000001' AND e.uuid = '<current-free-episode-uuid>')
   OR (u.uuid = '00000010-0000-4000-8000-000000000001' AND e.uuid = '00000004-0000-4000-8000-000000000002');
```

The collection confirms insertion and repeat-start idempotency, completion at the server video's two-thirds threshold, that a later start and concurrent start/completion do not clear completion, malformed/under-threshold inputs, unauthenticated access, paid entitlement, and that detail reads remain null for another user and anonymous requests. These mutation checks run near the end, after the existing read-only content checks.

The watch-progress HTTP scenario records the local time immediately before each `STARTED` and `COMPLETED` PUT, then checks the returned `lastPlayedAt` from the next drama-detail GET falls within that request-to-read interval, allowing five seconds at each edge. Keep the machine running Postman and the MySQL server clock-synchronized. This verifies both the initial insert and a later update through the API. It does not simulate a non-UTC MySQL session; the SQL explicitly uses `UTC_TIMESTAMP(3)` so these checks do not depend on the session time zone.

Inspect candidate records using this query:

```sql
SELECT
  u.uuid AS userUuid,
  d.uuid AS dramaUuid,
  e.uuid AS episodeUuid,
  p.position_ms AS positionMs,
  p.is_completed AS isCompleted,
  p.last_played_at AS lastPlayedAt
FROM user_watch_progress p
JOIN users u ON u.id = p.user_id
JOIN episodes e ON e.id = p.episode_id
JOIN dramas d ON d.id = e.drama_id
WHERE u.uuid = '00000010-0000-4000-8000-000000000001'
  AND d.uuid = '00000002-0000-4000-8000-000000000001'
ORDER BY e.episode_number;
```

The current development database uses the following fixture: admin `00000010-0000-4000-8000-000000000001`, drama `00000002-0000-4000-8000-000000000001`, episode `00000004-0000-4000-8000-000000000003`, position `0`, incomplete, last played `2026-10-28T00:00:00.000Z`. The unentitled user has no progress record for that episode.

To prepare this fixture after resetting the development database, insert the row idempotently:

```sql
INSERT INTO user_watch_progress
  (user_id, episode_id, position_ms, is_completed, last_played_at)
SELECT u.id, e.id, 0, 0, '2026-10-28 00:00:00.000'
FROM users u
JOIN episodes e ON e.uuid = '00000004-0000-4000-8000-000000000003'
JOIN dramas d ON d.id = e.drama_id
WHERE u.uuid = '00000010-0000-4000-8000-000000000001'
  AND d.uuid = '00000002-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM user_watch_progress p
    WHERE p.user_id = u.id AND p.episode_id = e.id
  );
```

For different IDs, pass the selected fixture values to Postman CLI (the timestamp must be UTC ISO 8601):

```powershell
$env:API_TEST_ENVIRONMENT_FILE = 'C:\path\to\local-postman-environment.json'
npm --prefix back run test:api -- --env-var watchProgressEpisodeUuid=<episode-uuid> --env-var watchProgressPositionMs=<position-ms> --env-var watchProgressIsCompleted=<true-or-false> --env-var watchProgressLastPlayedAt=<utc-iso-timestamp>
```

MySQL `DATETIME(3)` is returned by mysql2 as a JavaScript `Date`; the API serializes it with `toISOString()` as UTC. If the fixture query returns no row, the required non-null case cannot be verified and the API test must fail. The API test also checks that the returned episode list and entitlement state are unchanged by the progress join.
