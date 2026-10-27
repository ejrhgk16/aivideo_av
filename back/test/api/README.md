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
npm --prefix back run test:api -- --env-var baseUrl=http://localhost:3001
```

The backend's MySQL connection follows its own environment configuration. No separate test DB connection is needed. The collection does not use a cloud collection ID and disables event reporting.

`npm --prefix back run test` runs `test:unit` followed by `test:api`. Harness backend checks already call `test`, so workers and finish also run the real API checks. Server connection failures, request timeouts, missing required content, HTTP errors, and assertion failures fail the command. Do not report an unavailable API as a passing test.

## Existing data requirements

- `/genres` must return at least one genre.
- `/dramas` must return at least two public dramas. At least one must have a preview and both free and paid public episodes with FULL videos. The collection obtains their UUIDs from the responses; it does not hard-code seed UUIDs, titles, counts, or image paths.
- `HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY`, and `HOME_CAMPAIGN` must be active collections. Their drama arrays may be empty.
- Playback requires the existing development-only S3 signing configuration. Tests inspect the signed URL and its expiry; they do not request the S3 object or verify that the media object exists.
- Avoid editing the same content during a run: catalog/detail/collection consistency checks compare successive responses.

Tests may prepare the required development data through database setup, seeds, and data changes. If the requirements remain unmet, the run fails and reports the missing condition.

## Coverage

The login collection requests `POST /auth/login` with the seeded `admin` / `admin` credentials, repeats login with another well-formed pair (the controller currently substitutes admin/admin), and checks the public user/points response and custom 400 errors for malformed input.

The collection checks the root endpoint, genre/catalog response shapes and public UUIDs, default/invalid sort, detail/catalog consistency, public episode counts and ordering, free/paid episode playback, preview playback and ownership, missing-resource errors, four home collections and their ordering, and allowed/disallowed CORS origins and preflight. It also checks POST preflight for the development-only point increase and single-episode purchase paths. Preflight verifies CORS negotiation only; it does not prove the POST route or any balance, ledger, or entitlement change.

The collection checks the existing catalog, POST preflight, custom point error responses, including invalid input, missing user/episode, insufficient balance, and idempotency conflict. The insufficient-balance case requires a development test user `00000012-0000-4000-8000-000000000001` with an existing zero-point wallet. Prepare it in the configured development database with:

```sql
INSERT IGNORE INTO users
  (uuid, account_type, status, display_name, production_company_id)
VALUES
  ('00000012-0000-4000-8000-000000000001', 'MEMBER', 'ACTIVE', 'api-error-test', NULL);

INSERT IGNORE INTO wallets (user_id, available_points)
SELECT id, 0 FROM users
WHERE uuid = '00000012-0000-4000-8000-000000000001';
```

The key-conflict case uses the admin's seeded `seed:admin:initial-points:v1` key and makes no data change. Other requests do not mutate balances, ledgers, or entitlements. API responses do not expose publication timestamps or all hidden records, so latest publication ordering and every hidden/scheduled-content boundary cannot be proven from these HTTP responses alone. Focused unit tests retain publication/environment/scheduling boundaries and internal database/seed/storage rules.

### Drama detail entitlement fixtures

The detail collection cases also compare a user's entitlement with a second user's response. The collection variables provide defaults for these existing development records, so `npm --prefix back run test` and `test:api` work without extra arguments. Postman environment variables can override the defaults:

| Variable | Current development value | Purpose |
| --- | --- | --- |
| `entitledUserUuid` | `00000010-0000-4000-8000-000000000001` | Existing admin user with a paid entitlement |
| `unentitledUserUuid` | `00000012-0000-4000-8000-000000000001` | Existing user with no entitlement to the drama episodes |
| `entitlementDramaUuid` | `00000002-0000-4000-8000-000000000001` | Drama containing the fixture episodes |
| `entitledEpisodeUuid` | `00000004-0000-4000-8000-000000000002` | Paid episode owned by the first user |
| `lockedEpisodeUuid` | `00000004-0000-4000-8000-000000000003` | Paid episode owned by neither user |

The current DB was inspected using SELECT statements only. The same drama also contains a free episode (`00000004-0000-4000-8000-000000000001`). If local development data differs, set equivalent IDs for existing users, drama, and episodes in the Postman environment. The API collection must not create an entitlement or change point balances to prepare these cases.

To override the fixture defaults, pass environment values to Postman CLI:

```powershell
npm --prefix back run test -- -- --env-var entitledUserUuid=00000010-0000-4000-8000-000000000001 --env-var unentitledUserUuid=00000012-0000-4000-8000-000000000001 --env-var entitlementDramaUuid=00000002-0000-4000-8000-000000000001 --env-var entitledEpisodeUuid=00000004-0000-4000-8000-000000000002 --env-var lockedEpisodeUuid=00000004-0000-4000-8000-000000000003
```

The detail checks verify the owned paid episode is unlocked only for its owner, another paid episode stays locked, free episodes are unlocked for both users, and omitting `userUuid` does not expose a stored entitlement.

The drama detail collection requires one watch-progress fixture for the entitled user. It compares the response with `watchProgressEpisodeUuid`, `watchProgressPositionMs`, `watchProgressIsCompleted`, and `watchProgressLastPlayedAt`; the same episode must return `watchProgress: null` for `unentitledUserUuid` and with `userUuid` omitted. Defaults match the development fixture below. If local UUIDs differ, set these variables to the equivalent records in the Postman environment.

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
npm --prefix back run test -- -- --env-var watchProgressEpisodeUuid=<episode-uuid> --env-var watchProgressPositionMs=<position-ms> --env-var watchProgressIsCompleted=<true-or-false> --env-var watchProgressLastPlayedAt=<utc-iso-timestamp>
```

MySQL `DATETIME(3)` is returned by mysql2 as a JavaScript `Date`; the API serializes it with `toISOString()` as UTC. If the fixture query returns no row, the required non-null case cannot be verified and the API test must fail. The API test also checks that the returned episode list and entitlement state are unchanged by the progress join.
