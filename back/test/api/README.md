# Backend API tests

Postman CLI calls the running NestJS API over HTTP. The API uses its configured, real MySQL database; repositories and database responses are not mocked. Tests use existing content and make only GET and OPTIONS requests. They do not create/reset a database, run seeds, change records, or download images/videos from signed URLs.

## Run

Postman CLI must be installed (`postman --version`). Local collection execution does not require a Postman login. Keep database and AWS credentials in the existing Git-ignored `back/.env.development`, not in the collection.

From the repository root, start the development server in one terminal:

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

If these conditions are not met, the run fails and reports the missing condition. Prepare content through the normal development workflow; do not automatically seed or modify the existing DB from the test command.

## Coverage

The collection checks the root endpoint, genre/catalog response shapes and public UUIDs, default/invalid sort, detail/catalog consistency, public episode counts and ordering, free/paid episode playback, preview playback and ownership, missing-resource errors, four home collections and their ordering, and allowed/disallowed CORS origins and preflight.

These are integration checks against current data, not a controlled fixture suite. API responses do not expose publication timestamps or all hidden records, so latest publication ordering and every hidden/scheduled-content boundary cannot be proven from these HTTP responses alone. Focused unit tests retain publication/environment/scheduling boundaries and internal database/seed/storage rules. Deterministic HTTP coverage of those additional states would need separately authorized fixture data; the current suite does not create it.
