# Android follow-up implementation prompt

Implement this in a separately authorized Android task. The Hub work does not change Android or establish that content appears on a device.

Repository: `D:\download\vrajarealm-android-app-main (1)\vrajarealm-android-app-main`.
Contract source: sibling `vraja-content-hub/docs/openapi.json`, `API-CONTRACT.md` and `fixtures/manifest.json`.
Read Android `AGENTS.md`, inspect current dirty changes, and preserve user data and unrelated changes. Do not deploy the Hub, modify Firebase, change credentials, publish content or replace production data.

## Outcome and environment

Connect the existing Hub contracts to Room-backed Android repositories, with honest language fallback and safe reconciliation. Verify editor/API/device behavior separately. Start against an approved staging Hub with known reviewed records; do not assume the current production hostname serves this branch.

Replace the separate hard-coded Hub URLs in `di/NetworkModule.kt:21` and `data/remote/WallpaperRemoteDataSource.kt:30` with one injected build-environment configuration. Keep unrelated IP-location/calendar service URLs separate. Include environment identity in cache keys or invalidate only remote caches on environment switch. Do not ship debug/staging URLs in release builds. Record the exact tested Hub revision from `/api/capabilities`.

## Shared parsing and reconciliation

- Parse the synthetic fixtures with the app's actual Moshi adapters. Preserve existing v1 arrays and optional-field behavior; reject HTML, malformed JSON and unsupported payloads. These fixtures are test text, never devotional seed content.
- Represent success, successful empty scope, unavailable detail and transport/HTTP/schema failure as distinct results. Failed calls must not clear Room or advance a last-success timestamp.
- Store source ownership, environment, locale and scope with remote records. A complete successful response may withdraw only records belonging to that response's Hub scope. Keep bundled records, other calendar sources and all personal state.
- Keep Room as the first observable source. Offline data stays readable. Cache timestamps must be nullable and tolerate future/expired values without overflow.
- No Hub response can claim that a device synced successfully. Add telemetry only through a separate explicit product decision.

## Categories, artwork and placements

`data/model/api/ApiWallpaperCategory.kt` already accepts `id`, `name`, `parent_id`, `active_wallpaper_count`, `is_active`, `is_selectable`, `sort_order`. The public tree is complete, includes empty nodes, and uses effective ancestor activity. Preserve ancestor relationships and stable IDs. `active_wallpaper_count` includes eligible ordinary wallpapers anywhere in a subtree; sponsors are excluded. `editorial_is_active` is optional diagnostic metadata.

Use `category_id` for subtree filtering. Legacy `category` is an exact name/slug match, not free-text search; unknown is empty and ambiguous is 400. Never remove the filter and retry as all wallpapers. Category-tree pagination is unsupported. Unpaginated media retains the complete legacy array; explicit page/limit is partial and cannot authorize deletion. Prefer complete unpaginated scope for reconciliation until media snapshot pagination is added.

Extend `ApiWallpaper` and its Room/domain mapping to preserve description, deity, temple, location, credit, source name/URL, provenance, rights status, locale, alt text, dimensions and crop. Stop manufacturing description from the name or an unspecified generic source when actual metadata is available. Unknown rights remain unknown. Credit/provenance should be accessible in artwork details.

Use separate consumers for `/darshan`, `/events` (festival artwork) and `/sponsors`. Existing API declarations alone are not integration. Wire only an explicitly chosen screen/widget placement. Sponsors require an explicit sponsor placement and disclosure; never merge them into devotional wallpaper/Darshan/Katha rotation. The Hub supplies `placement_eligibility`, but the product team must approve where each new consumer appears. Keep the wallpaper-details replacement layout as Android UI work with its own acceptance screenshots.

Compute editorial dates in `Asia/Kolkata`. `visible_date` is inclusive; `expires_on` is the first hidden day. Darshan is eligible only on its visible day. Device timezone changes must not shift these dates. Revalidate at India midnight, foreground and manual refresh; include day, endpoint, category/type and pagination in cache keys.

## Daily verse

Extend `DailyVerseRepository` and `VrajaContentHubApiService` to parse selection mode, requested/selected/translation locale, fallback flag, source/translator/edition/provenance, content revision and assignment revision. Keep Sanskrit, transliteration, translation and original reflection separate.

Request the user's canonical BCP47 locale and the India day. The server chooses requested locale, base language, then English, considering scheduled content before the pool within each language. Display the language actually returned. Do not label English as Hindi. Refresh an already cached day so a reviewed correction can replace its payload when assignment revision advances. Ordinary pool edits should retain the frozen current-day assignment. Source withdrawal may replace it or produce JSON 404 for bundled fallback. Use independent cache identities for `hi`, `hi-IN`, `en` and `mr` requests even when fallback payload IDs match.

The 90-day Hub proposal contains briefs with missing verified text. It is not a published library and must not be bundled or auto-imported.

## Calendar and Panchang

Update `data/api/ContentHubEventsDataSource.kt`, the Hub service/model and repository reconciliation to request inclusive `from`/`to`, locale, location key, IANA timezone and applicable tradition/region keys. Agree stable keys with editors; human-readable city names alone are insufficient identifiers.

Parse stable event ID, revision, source, selected language/fallback, applicability/scope and `timingWithheld`. Hindi requires a complete title/description pair; preserve an honest English fallback. Missing Hindi fasting guidance is absent, not English labelled as Hindi.

Respect both Parana forms: a normal window has date/start/end and omits `paranaType`; start-only has date/start and `paranaType="after"`, with no end. Timings are eligible only for an exact location/timezone match with a recorded source. Never copy a Mumbai override into another city. When timing is withheld, retain the explanation and use the established location-aware engine if it has valid timing.

Precedence: the existing calculation engine owns precise tithi/sunrise/sunset/Choghadiya/countdowns. Hub content adds explanations and editorial descriptions. A reviewed scoped Hub clock-time override may supersede engine display only for its exact event/date/location/timezone and a product-approved source-priority policy; otherwise show the engine result and source attribution. Resolve conflicts visibly in diagnostics, not by silently choosing whichever request finishes last. Keep multiple same-day events. Do not merge identities solely by title/date; retain provider IDs and an explicit curated equivalence map if deduplication is needed.

Cancellation/unpublishing removes only the Hub-owned event from a complete successfully refreshed scope. It must not delete an engine festival or unrelated Room rows. A failed or partially fetched range retains all prior data. A day without Hub events is not a missing Panchang calculation.

## Atomic scripture updates and canto migration

Inspect `ScriptureHubRepository`, `ScriptureVerse`, and `data/local/dao/ScriptureDao.kt`. The current unique index uses `(scriptureId, chapterNum, verseNum)` and omits canto. `updateExtendedFields` likewise omits canto and updates only supplemental fields. Fix both before enabling new downloads; the Hub preserves distinct canto references.

1. Introduce a non-null normalized canto identity (0 only for sources without cantos). Build a unique index on `(scriptureId, cantoIdentity, chapterNum, verseNum)`. A nullable SQLite unique column is insufficient because multiple nulls do not collide. Validate positive actual canto numbers.
2. Write an explicit Room migration preserving existing verse row IDs and foreign keys/bookmarks/read state. Backfill canto from reliable existing data. If previously collapsed records cannot be disambiguated, keep personal state against its legacy key and record a migration exception for reconciliation; never invent a canto or delete user data. Copy-and-swap only with verified counts and foreign-key checks; do not use destructive migration fallback.
3. Download the catalogue entry's relative `downloadUrl` against the configured Hub origin. Require its advertised version/hash. Hash the exact uncompressed UTF-8 response bytes before JSON parsing; do not hash reserialized DTOs. Validate count and every canto-aware reference before installing.
4. On 409, discard only the staged payload and refresh the catalogue. On 404, mark that remote scripture unavailable while preserving personal state. On any network/parse/hash failure, retain the installed version and old text.
5. In one Room transaction, upsert canonical rows preserving existing IDs by reference, replace changed Sanskrit/transliteration/translation/purport and supplemental fields, apply explicit clears for absent optional fields in a complete snapshot, update visibility for withdrawn references, and finally store the installed version/hash. Never mark the catalogue version installed after only `INSERT IGNORE` or `refreshExtendedFields`.
6. Separate server text from personal annotations/progress so full canonical replacement cannot reset them. Remove/archive withdrawn content only after a complete validated snapshot; keep its reference and personal state for possible restoration.

Regression: seed two cantos with chapter 1/verse 1, attach separate bookmarks/progress, download a correction to only canto 2, and assert both rows/IDs survive with the correct independent text and personal state. Also simulate process cancellation, hash mismatch, newer catalogue with old body, optional-field clearing and source withdrawal.

## Katha and Books

The Hub's canonical story is `books.id` with `is_story=true`. `story.id == bookId`; `story_body` is the readable narrative and Books pages are illustrated context/captions. Do not create a second competing story source. `LocalStoryFeedRepository` currently emits local content; `FeedSource.CLOUD` and `cloudId` are reserved but not a working consumer.

Add a Room remote-story table keyed by `(environment, cloudId, locale)` and separate personal-state storage keyed by `(environment, cloudId)`. Remote UUIDs must not be cast into `PuranaStory`'s Long IDs or merged using `storyNum`. Use `StoryFeedItem.key="hub:<environment>:<uuid>"`, `source=CLOUD`, `cloudId=id`, `storyId=0`, plus returned title/summary/cover/deities/reading duration. The current `puranaTitle`/`puranaColorHex` assumptions need a source-neutral presentation field for remote stories; do not invent a parent Purana. Keep local cards' existing mapping.

Fetch `/stories` pages with the same snapshot, locale and limit. Stage all pages and swap the feed only after the full snapshot succeeds. A 409 restarts staged pagination while keeping the prior feed. Cache `/stories/{id}` for offline reader navigation using cloud ID. Preserve bookmark/read state across version changes and withdrawal. Full Hindi narrative and per-page caption language can fall back independently; label the selected language. Never open a remote story through a local Purana Long-ID reader route.

## Lock-screen quotes

`QuoteRepositoryImpl` currently loads bundled `quotes.json`. Add `/quotes/selection` with Room cache by environment/India-day/requested-locale and revision. Distinguish `exact_quote`, `translated_scripture` and `original_reflection` in attribution; original editorial prose must not be presented as scripture. Preserve reference, source, translator and rights metadata. A successful response does not override the user's local quote-visibility setting. Respect visibility in preview, worker, widget and wallpaper rendering paths. Use a suitable bundled fallback on unavailability/failure, subject to the same local setting. Do not treat a remote quote as verified merely because an API returns 200.

## Required evidence before claiming connection

Run appropriate Android compile/unit/Room migration tests, fixture parser tests and `git diff --check`. Report unrelated baseline failures separately. On a test device/emulator, demonstrate real content from the approved Hub revision, refresh/correction, offline reading, Hindi/regional fallback, India midnight, nonmatching-city timing, successful empty reconciliation and HTTP/HTML failure preservation. Verify quotes off stays off and remote story bookmarks/read state survive updates. Do not call any unimplemented placement connected. Record screenshots and exact tested environments; APK replacement requires the separate authorization already applicable to that task.

Open product decisions: approved staging/production hostname; scope-key registry and timing-source precedence; Darshan/festival/sponsor placements; verified English/Hindi source material; remote Katha source-label design. Complete independent repository/cache work while these decisions are being resolved.
