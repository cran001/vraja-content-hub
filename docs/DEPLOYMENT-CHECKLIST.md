# Approval-gated deployment checklist

Prepared for local branch `feat/dashboard-sections`. No push, deployment, real database migration, credential change, Firebase change or production upload was performed. A production project/account mapping has not been confirmed. The existing Android URL `https://vraja-content-hub.vercel.app/` is a client reference, not proof that it is the correct deployment target for this branch.

## Release blockers and explicit approval

- Resolve or formally assess the current dependency audit before release: 18 findings (1 low, 2 moderate, 13 high, 2 critical) on 10 September 2026. Direct flagged dependencies include Next.js and node-pg-migrate. See IMPLEMENTATION-STATUS.md. Feature test success does not resolve dependency advisories.
- Verify the intended hosting project, owning account, repository, production branch, exact commit, staging and production URLs, database identity and Cloudinary environment. No values should be guessed from a matching project name.
- Obtain approval for the concrete reviewed commit/diff, target project, migration plan, backup/restore checkpoint, deployment and any staging/production uploads. Do not put tokens, URLs containing passwords or private account details into the approval document.
- Complete the separate Android task before claiming new consumers are connected. Review the choice to withhold previously unscoped timings; this safely changes timing availability for older clients.

## Environments and local setup

Use an isolated PostgreSQL database and asset account for local/staging work. Required server variables: `DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Optional `HUB_REVISION` is a non-sensitive Git SHA; hosting may supply `VERCEL_GIT_COMMIT_SHA`. Keep secrets server-only and out of `NEXT_PUBLIC_*`, source, screenshots and logs. Do not copy production credentials into a disposable test environment.

Use the Node version supported by the installed Next.js and migration packages; this run used Node 24.14.1 and PostgreSQL 16. Run `npm ci`, then the checks below. For ordinary local development, provision a new approved local database, apply its pending migrations and run `npm run dev`. `npm run migrate` loads `.env`: verify the target before using it. Never run that convenience command as a blind test step.

`npm test` initializes its own verified loopback PostgreSQL cluster, ignores incoming DATABASE_URL, blanks asset credentials and stops the cluster afterward. It never reseeds normal data. Set `HUB_TEST_PG_BIN` only if the PostgreSQL binaries are elsewhere. Evidence stays in ignored `.test-db/<run-id>/`. `node scripts/test-disposable.mjs --serve` serves a synthetic browser fixture on port 3107 using the last production build; stop that process and its exact scratch cluster after testing.

Account provisioning is an explicit operator step, not automatic deployment. `scripts/seed-admin.js` now requires `HUB_ADMIN_EMAIL`, `HUB_ADMIN_PASSWORD`, `HUB_ADMIN_ROLE` (`super_admin` or `community_admin`) and `HUB_CONFIRM_ACCOUNT_CREATE=yes`; it never overwrites an existing account. Use protected environment input and never echo the password. Do not run the old content seeding scripts against an existing environment. The 90-day draft proposal is not an import script.

## Backup, preflight and migration order

1. Capture the current app revision, migration registry and read-only inventory separately for each environment. Record content counts/IDs/visibility, daily links/schedules, verse reference counts, role-value counts and category hierarchy health. The 9 September local counts are historical; do not treat them as current production counts.
2. Take an encrypted logical PostgreSQL backup, a schema-only backup, migration registry export and asset inventory. Use an approved PostgreSQL service/secure passfile so credentials do not appear in commands. Verify a restore into a newly named isolated database and compare counts, stable IDs, dependent selections and visibility. A backup file without a tested restore is insufficient.
3. Compare `pgmigrations` to the repository. Inspect pending migration SQL. Investigate duplicates, missing references, unknown roles and orphan/cyclic category paths before applying anything. Resolve with the content owner; never auto-delete rows to satisfy a constraint.
4. Apply unapplied migrations in numeric order with the approved migration role. The historical sequence is:

| Migration | Purpose |
|---|---|
| 1752082940572 | Admin accounts |
| 1752154786479 | Wallpapers |
| 1752200000000 | Categories |
| 1752200001000 | Media schedules |
| 1752200002000 | Account roles |
| 1787356800000 | Books |
| 1787356801000 | Book pages |
| 1787356802000 | Dated events; pre-existing untracked work |
| 1787356803000 | Scriptures; pre-existing untracked work |
| 1787356804000 | Scripture verses; pre-existing untracked work |
| 1787356805000 | Daily selections; pre-existing untracked work |
| **1787356806000** | **Content integrity, audit, publication state, media metadata/ledger, daily assignments** |
| **1787356807000** | **Scoped event metadata, immutable scripture snapshots, assignment audit identity** |
| **1787356808000** | **Books/story mapping, page revisions, typed quotes** |

5. The new migrations are forward-only. Active/inactive records are mapped to published/archived; missing source/rights remain unknown. Existing publication is preserved, not retrospectively certified. Account roles are not promoted. Verify the same ID/link/visibility comparisons after migration.
6. Coordinate a brief editorial maintenance window. Old admin code is not safe to keep writing across the new publication triggers. Deploy the reviewed matching application revision and verify readiness before reopening editing. Keep detailed diagnostics behind super_admin authorization.

## Staging verification before production

Run `npm run typecheck`, `npm run lint`, `npm run test:contracts`, `npm run test:fixtures`, `npm test`, `npm run build`, `npm run test:http` and `git diff --check`. Re-run the dependency audit after any dependency remediation. Verify actual staging Cloudinary upload, retry, partial failure and cleanup using only approved test assets; local tests use a simulated asset gateway and do not establish service credentials, quotas or proxy upload limits. The server allows 8 MiB/file and 32 MiB/batch, but hosting request-body limits can be lower; choose the supported production upload strategy before release.

Manually complete an authenticated dashboard pass: create a draft, add provenance, mark reviewed, publish, inspect its public payload, unpublish, inspect withdrawal and audit. Verify a community account sees only contributions. Exercise calendar preview, daily Hindi/English preview/coverage, category active/selectable/order controls, story narrative, quote attribution and upload recovery. A focused disposable browser pass was completed; repeat it against the approved staging service and real test assets. See the status record.

## Public smoke tests on the exact deployed revision

Use GET only until approved staging/production editorial test data exists. For each request verify status, JSON content type, response shape and the intended environment. HTML 404, network failure or malformed JSON fails the check; JSON 404 for a genuinely unavailable detail/selection is a valid documented absence. Empty 200 is meaningful only after confirming the environment's inventory. Record the revision and test time.

| Route | Check |
|---|---|
| `/api/health`, `/api/capabilities` | 200 schema-ready and expected commit; a DB ping alone is insufficient |
| `/api/v1/wallpaper-categories?date=YYYY-MM-DD` | Complete tree, stable IDs, subtree counts, empty and inactive nodes |
| `/api/v1/wallpapers` | Legacy array and full-list default; category_id/legacy filter and metadata |
| `/api/v1/darshan?date=YYYY-MM-DD` | `{date,timezone,items}` for exact India day |
| `/api/v1/events?date=YYYY-MM-DD` | Festival artwork envelope, distinct from calendar data |
| `/api/v1/sponsors?date=YYYY-MM-DD` | Sponsor array, excluded from devotional collections |
| `/api/v1/daily-verse?date=YYYY-MM-DD&locale=en` | Scheduled/pool mode, stable assignment and revisions |
| Same daily route with `hi-IN` and `mr` | Honest selected/translation locale and English/base fallback |
| `/api/v1/events/dated?from=YYYY-MM-DD&to=YYYY-MM-DD` | Inclusive range, multiple same-day events, no unscoped timings |
| Same calendar range with agreed location/timezone/region/tradition | Matching scope only; Parana window/after; Hindi fallback |
| `/api/v1/scriptures` | Actual catalogue counts, source, version/hash and URL |
| Catalogue-provided `downloadUrl` | SHA256 over uncompressed bytes, version headers and complete canto references |
| Old version/hash URL and unpublished scripture detail | 409/404 JSON; must not return stale success |
| `/api/v1/books` and `?id=<known-book-id>` | Legacy list/detail pages preserved; unavailable detail404 |
| `/api/v1/stories?locale=en&limit=1` and all snapshot pages | Stable book/story IDs, complete snapshot pagination and fallback |
| `/api/v1/stories/<known-story-id>?locale=hi` | Reader body, cover, references and honest language/page fallback |
| `/api/v1/quotes/selection?date=YYYY-MM-DD&locale=hi-IN` | Typed attribution, fallback, eligibility and Android-setting policy |

Also verify invalid category UUID/page/date =>400; unauthenticated admin requests=>401; restricted shared publishing/deletion=>403. Use at least one known reviewed scripture/story/quote when validating positive content paths. If none exists, report the positive test as pending instead of claiming full coverage from empty responses.

## Recovery and rollback

Keep a coherent app/schema pair. Do not execute destructive `down` migrations: the new migration files intentionally reject them. Prefer a reviewed forward fix. If rollback requires the old schema, stop editorial writes, restore the verified pre-migration backup to a separate database, verify counts/IDs/links/visibility, and switch the approved old application and database together. Reconcile any intervening writes from preserved audit/backup evidence before reopening editing. Retain asset uploads and cleanup ledgers until references are checked; never bulk-delete assets as a rollback shortcut.

After release, check admin readiness, failed/pending media ledger entries and manual cleanup retries. No recurring production cleanup or monitoring automation was created by this task. Schedule operations only with explicit authorization.
