# Content Hub implementation record

Scope: local Hub only; branch `feat/dashboard-sections`. No Android edits, deployment, push, production migration, credential change or production upload is authorized.

## Baseline (2026-09-09)

- Read `../goal-verification/CONTENT-HUB-AUDIT-20260909.md` and Android AGENTS.md. No Hub AGENTS.md was found.
- Preserved pre-existing dirty dashboard/sidebar/styles/requests/tsconfig and untracked scripture, daily-verse and dated-event implementations and migrations.
- `node scripts/verify-content-contracts.mts`: passed.
- `npx --no-install tsc --noEmit --incremental false`: passed.
- `npm run lint`: failed (`next lint` is unavailable).
- Reconfirmed hardcoded Android Hub URLs, destructive scripture replacement, cascading daily FK, role fallback and clearing partial media updates in source.
- Docker is unavailable. PostgreSQL 16 binaries are installed; integration tests will initialize their own disposable cluster with a marker and separate port, without using `.env` or the normal database.
- Browser retrieval of live APIs was unavailable; live deployment remains unverified in this run.

## Local implementation completed, 2026-09-11

The Hub implementation, local verification and requested handoff artifacts are complete. This is **not production release approval or proof of Android integration**. The normal local database remains on its original schema; only verified disposable databases received the new migrations.

- Stable, transactional scripture imports preserve reference IDs and daily/quote dependencies, validate whole batches, handle concurrent versions and show removal/dependency previews. The editor retains absent references by default and requires preview before import.
- Every admin route reloads the trusted account role. Shared content is super_admin-only; community_admin has an owned draft/submission intake. Editorial states, provenance review, revision checks and durable actor audit are explicit. Existing active/inactive visibility is preserved by migration.
- Media partial updates preserve omitted fields. Server validation, upload idempotency, atomic record batches, compensation and reference-checked cleanup cover media, covers, pages and event banners. Categories expose a complete tree and safe leaf deletion reports.
- Daily selection supports truthful English/Hindi/regional fallback, schedules, preview/90-day coverage, frozen current-day choices and reviewed corrections. Calendar content has scope/source/language metadata, range preview, duplicates, cancellation and location-matched Parana semantics.
- Scripture catalogue/body distribution uses immutable version/hash snapshots and canto-aware references. Stories reuse Books identity and pages; typed quotes remain separate from scripture attribution and respect Android's visibility policy in their contract.
- Publishing, readiness, contribution, Katha, quote, category and calendar controls are available in the dashboard. Non-sensitive capabilities distinguish schema readiness from a mere database ping. No device-sync telemetry is claimed.

## Current environment evidence

`npx --no-install dotenv -e .env -- node scripts/inspect-local-inventory.mjs` completed read-only on 2026-09-10 at 09:32 UTC, restricted to the configured loopback database. It found 36 active English daily selections, zero scheduled selections, 3 active scriptures with 715 verses, 3 active dated events, and zero books/categories/wallpapers. The migration registry ends at `1787356805000_create-daily-verses-table`. No normal content was changed. These are local counts, not production counts.

Source inspection reconfirmed the two hard-coded Android Hub URLs, local-only Katha repository, bundled quotes and canto-omitting scripture index/update path. See the separate Android prompt for exact files and required corrections. Production GET retrieval remained unavailable through the browsing tool, including capability, daily and category routes; this run does not reconfirm the historical live 404s or wallpaper count.

## Final verification

| Command | Result and scope |
|---|---|
| `npm run typecheck` | Passed, no TypeScript errors |
| `npm run lint` | Passed with zero warnings; replaced broken baseline `next lint` command |
| `npm run test:contracts` | All existing scripture/daily/Parana contract checks passed |
| `npm test` | **18/18 passed**, plus upgrade assertions preserving IDs, daily links and active/inactive visibility |
| `npm run test:fixtures` | **26 JSON response fixtures**, two exact-byte scripture hashes, canto identity and 90 unpublished briefs passed |
| `npm run build` | Passed optimized Next.js build; 37 generated route/page entries, dynamic content routes |
| `npm run test:http` | Passed actual compiled-server login, trusted account lookup, readiness, unauthenticated rejection, draft creation, calendar preview and multipart validation, on a fresh disposable database |
| `git diff --check` | Passed; Windows line-ending notices are non-failing |

The final integration evidence directory is `.test-db/0b3f3308-d4b4-489b-b519-8af5002a9e44/`; the harness stopped the cluster. The final compiled HTTP run is `.test-db/7cf19d77-d6fe-4009-b397-21a4672acc95/`; its cluster was stopped. Each HTTP run owns a newly initialized cluster. The test harness does not load `.env`, verifies the cluster's user and data directory, and blanks asset credentials. Public fixture exports are opt-in via `HUB_EXPORT_FIXTURES=1`; regular tests validate real route responses without rewriting fixture files.

Production HTTP testing found and fixed a defect missed by imported route tests: constructing a trusted NextRequest from another bundled Request object returned 500 after login. The wrapper now reconstructs from URL/method/stream and applies trusted headers. The compiled-server test prevents that failure from being hidden by a green unit suite.

Browser verification used only `--serve` disposable fixtures. Confirmed login/readiness rendering; creating a synthetic quote draft; adding provenance; review/publish/unpublish transitions with revisions 1→2→3→4; the public quote returned revision 3 while published; default calendar coverage rendered; the Katha editor saved synthetic narrative/summary on its existing book. Source and publication fields were visibly present. This was a focused functional desktop pass, not exhaustive accessibility, mobile-browser or every-form visual testing. No real media uploads were made.

## Acceptance evidence

| Requested acceptance item | Authoritative local evidence | External boundary |
|---|---|---|
| 1. Reimport/correction preserves selections and IDs | `scriptureImport.ts`; identical/corrected/invalid/dependent/concurrent import tests; upgrade assertions | Reviewed real imports remain an operator action |
| 2. Roleless/restricted accounts cannot publish/delete | `admin.ts`; every-handler authentication sweep, expired/unknown-role and community ownership tests; compiled HTTP smoke | Actual production account role inventory must be reviewed before migration |
| 3. Media toggles preserve category and dates | Partial-update test covers visibility and sponsor/type toggles, explicit null and invalid values | Real asset service integration still needs approved staging verification |
| 4. Category tree/filter compatibility | Three-level/empty/inactive subtree tests and actual response fixtures; verified Android category model | Android consumer changes are a separate task |
| 5. Daily locales/scheduling/midnight/correction | Daily selection test, canonical locale/draft test, India midnight boundary assertions and next-day selection; English/Hindi/regional fixtures | Verified Hindi source and reflection review are editorial work |
| 6. Scoped date/media/timing behavior | Inclusive date range and exclusive media expiry tests; window/after, mismatched-city and cancellation tests; shared calendar preview selector | Precise Panchang remains in Android's location-aware engine |
| 7. Catalogue/body versions and corrections | Hash/version/old URL/withdrawal tests; exact-byte fixtures; canto collision test | Installed Android primary-text and Room migration fixes specified, not implemented here |
| 8. Story/quote contracts | Books identity, pagination, language, future publication, withdrawal and quote eligibility tests; editor browser pass | Katha/quotes/Darshan/festival/sponsor device wiring not claimed |
| 9. Failure versus successful empty | Typed 400/404/409/500 fixtures, empty collection/envelope fixtures, full-scope reconciliation and snapshot contracts | Android must implement the specified ownership-aware cache behavior |
| 10. v1 shapes and release smoke list | Existing contract checks, additive OpenAPI schemas, legacy books/media arrays; deployment checklist enumerates every public route | Post-deployment smoke execution is approval-gated and was not performed |

Additional phase requirements are covered by migration audit/publication triggers, safe upload ledger/partial-batch/DB-failure tests, source metadata publishing validation, category dependency reports, the daily/calendar preview controls, admin-only readiness diagnostics, contribution ownership tests, and the documents below. Editorial source verification is never inferred from a keyword detector, an API response or test text.

## Handoff files

- `CHANGE-MANIFEST.md`: current changed/untracked file inventory, distinguishing known preserved earlier work.
- `API-CONTRACT.md` and `openapi.json`: public shapes, critical mutation schemas, roles, model decisions, scheduling, caching and reconciliation.
- `fixtures/manifest.json`: 26 synthetic parser examples, including empty, language fallback, failures, Parana and two-canto scripture responses.
- `editorial-library-90-day-drafts.json`: 90 ordered theme/brief proposals, all drafts, with verified passage/translation/reflection/source fields left explicitly unavailable. No auto-import or auto-publication.
- `ANDROID-FOLLOW-UP.md`: separately scoped implementation prompt for shared URLs, category/media mapping, placements, daily/quote/story consumers, event scope and atomic canto-aware scripture updates.
- `DEPLOYMENT-CHECKLIST.md`: project/branch approval, environment configuration, exact migration order, tested backup/restore, coordinated rollback and all public smoke routes.

New migrations are `1787356806000_content-integrity.js`, `1787356807000_editorial-contracts.js` and `1787356808000_stories-and-quotes.js`. Historical untracked migrations 2000–5000 were preserved. No Git commit or push was made.

## Remaining release and editorial decisions

1. **Dependency security blocker:** the 2026-09-10 `npm audit` reported 18 findings: 1 low, 2 moderate, 13 high, 2 critical. Direct flagged packages include Next.js and node-pg-migrate; tar is also critical transitively. These inherited dependencies were not broadly upgraded in this content-integrity task. Resolve or assess the exact advisories and repeat release checks before deployment.
2. Confirm the intended hosting project/account and staging/production URLs. Back up and approve migrations/deployment as a separate action. The current normal local DB also needs its pending migrations before running the new editors against that environment.
3. Verify real staging Cloudinary credentials, hosting body-size limits and retry/cleanup behavior with approved test assets. The local simulated gateway proves failure handling logic, not external service setup.
4. Supply verified scripture translations/permissions, reviewer decisions and complete Hindi material. Decide scope keys/timing-source precedence and the Android placements for Darshan/festival artwork/sponsors. Review Katha sources and actual covers before publication.
5. Implement and verify the Android follow-up. No Android files or Firebase configuration were edited. Existing device caches are not fixed by changing this Hub alone.

Non-failing tooling limitations: Next.js reports the deprecated middleware filename convention, and the legacy standalone TypeScript contract script reports Node's module-type warning. CodeRabbit 0.7.5 was installed but signed out; no automated CodeRabbit review was run. Direct code inspection and the tests above were completed. These notes are separate from the fixed baseline lint failure.
