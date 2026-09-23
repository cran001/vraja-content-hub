# Content Hub contract and model decisions

This describes the local implementation. It does not establish that production has these routes or that Android consumes them. `openapi.json` is the machine-readable public contract; `fixtures/` contains synthetic Android parser examples, not publishable scripture or artwork.

## Identity, access and workflow

The actual account roles are `super_admin` and `community_admin`. The server verifies an HS256 token with expiration, then reloads the account by UUID. Role claims and incoming `x-user-*` headers grant no authority. Missing/unknown database roles are denied. New accounts have no default role. `community_name` is descriptive, not a reliable tenant identifier.

| Operation | super_admin | community_admin |
|---|---|---|
| Account identity | Own account | Own account |
| Shared category list | Read | Read |
| Contributions | Read all; edit/submit own | Read/edit/submit own drafts |
| Shared content and detailed readiness | Read/edit | Denied |
| Review, publish, unpublish, archive, delete | Allowed with validation/dependency checks | Denied |
| Account provisioning | Explicit operator script; no web endpoint | No implicit grant |

Contributions are an intake queue, not a second published library. An editor transfers accepted material into its canonical record. Multi-community shared editing is deliberately unavailable until trustworthy tenant IDs and ownership migration are designed.

Editorial records use `draft → review → published`; `draft` and `archived` are not public. The migration maps existing active records to published and inactive records to archived without changing their active flags. New records start as drafts, including old forms that send `is_active=true`. Publishing requires reviewed source/provenance/rights and reviewer notes. A draft daily selection can share a date/locale with a published one; only published selections conflict. Save a replacement draft, review it, unpublish the previous selection and publish the replacement. Use the reviewed-day correction endpoint to refresh an already assigned day.

Shared operations use transactions with a server-supplied actor UUID. Database audit triggers record before/after content, action, entity and actor. Account passwords, JWTs and request headers are not audit inputs. Historical authors/reviewers are not invented. Audit rows survive content deletion.

## Public response and reconciliation rules

Existing v1 arrays remain arrays. New fields are additive. A non-2xx response, malformed JSON, a network failure, or an HTML response is **not an empty collection**. Retain cached content and personal state; retry or use a bundled fallback. Never advance a successful-sync marker on failure.

Successful complete empty responses mean no currently published content in the requested scope. They can withdraw server-owned content from that scope after validation, but cannot delete bookmarks, notes, read progress or bundled content. A partial page never authorizes deletion. Story reconciliation requires every page of the same snapshot. Detail 404 means unavailable, not permission to erase personal state.

Public editorial responses use `no-store` or `no-cache` to make corrections/withdrawals visible to a refreshing client. This cannot invalidate an old Android application's private cache; the Android follow-up must implement revalidation. The Hub has no device-sync telemetry.

## Categories and media

- `/api/v1/wallpaper-categories` returns the complete flat ancestor tree, including empty/inactive nodes. `parent_id` links stable UUIDs. Counts include currently eligible ordinary wallpapers in the whole subtree, excluding sponsors. An inactive ancestor withholds its descendants' media and makes the subtree non-selectable. Public `is_active` includes all ancestors, so Android's existing inactive-node mapper does not leave active orphans; additive `editorial_is_active` retains the node's own setting. Empty active categories have count zero; `is_selectable` is an editorial setting, additionally false under an inactive ancestor. Tree pagination is rejected.
- `/api/v1/wallpapers` is an array. No pagination parameters preserves the legacy full-list behavior. Explicit `page` (1+) and `limit` (1–500) opt into pagination. `category_id` selects a subtree. Legacy `category` resolves an exact slug or name to the same subtree; an unknown value returns `[]`, an ambiguous value returns 400. Supplying both filters is rejected. Invalid UUIDs, dates, limits and content types are rejected.
- `/darshan` and `/events` retain `{date, items}` envelopes with additive timezone. `/events` means festival artwork; `/events/dated` means calendar records. `/sponsors` remains an array. Wallpaper, Darshan, event and sponsor are explicit types. Sponsor flag/type must agree on mutation and sponsors never enter devotional endpoints silently. `placement_eligibility` is descriptive; Android must implement each placement separately.
- Every scheduled media day is in `Asia/Kolkata`. `visible_date` is inclusive. `expires_on` is the **first hidden date** (exclusive). Ordinary wallpaper/event/sponsor content uses the interval; Darshan is eligible only on its visible date. Null bounds are open. `?date=` previews that day. Cache identity includes endpoint, date, type/category, page and limit. Device timezone changes do not redefine the editorial day.
- Payloads add description, deity, temple, location, credit, source URL/name, rights/provenance, locale, alt text, dimensions and optional normalized crop bounds. Unknown provenance remains unknown. Uploaded thumbnails preserve image bounds with a limit crop; original artwork remains available.

Partial media PUT distinguishes omitted fields (preserved), null (nullable fields cleared), and invalid values (400/422). Uploads accept JPEG/PNG/WebP signatures, 8 MiB per file, 20 files and 32 MiB per batch. Vercel/request-proxy limits may be lower; the UI sends individual files. Use `Idempotency-Key` for retries. A ledger with deterministic asset IDs is committed before Cloudinary. Batch database mutations are atomic; failed batches compensate assets or persist cleanup work. Uncertain commit outcomes retain assets until ledger inspection. Pending uploads older than 15 minutes can be queued for recovery in `/api/admin/media-cleanup`; the save path checks the ledger before committing. Cleanup is explicit and reference checked, not an automatically scheduled production job.

Category deletion allows only an empty leaf and returns a complete subtree/media dependency report otherwise. Book/scripture deletion is similarly conservative; archive previously distributed content. Asset deletion is queued after the database change, with retries in the cleanup manager. No real assets were uploaded during this implementation.

## Daily verses

`daily_verses` curates a linked `scripture_verses.id`; it does not copy the canonical Sanskrit into a disconnected library. Original reflection, optional translation override, language, source/translator/edition/provenance, theme, priority and schedule remain distinct.

Selection order is requested locale (scheduled, then pool), base language (scheduled, then pool), English (scheduled, then pool). Pool order is priority descending then stable ID; the day index is epoch-day modulo pool size. A translation is eligible only when its declared language matches the reflection language. Hindi is not a label for English text. Translation overrides must be explicitly assigned the correct `translation_locale` and reviewed in Publishing.

The first successful read on the current India day stores a full assignment. Pool edits do not change that approved day. The editor preview uses the same selector but never creates assignments. Future previews are provisional. `/api/admin/daily-preview?coverage=true` shows 90 days, distinguishing scheduled coverage from pool gaps and language fallback. `/api/admin/daily-preview` POST selects an eligible published replacement with a review reason, preserving the prior assignment in audit history and incrementing its revision. Source or selection withdrawal invalidates a frozen assignment and selects an eligible replacement, or returns 404 for bundled fallback. Responses expose selected language, fallback/mode, content revision and assignment revision.

`editorial-library-90-day-drafts.json` is a proposal file only. It supplies editorial briefs and theme slots, not fabricated scripture. Every slot needs a verified source, translation permissions, English/Hindi review and human approval before canonical records are created/published.

## Calendar data

The calendar manager previews the same public selector through `/api/admin/calendar-preview`, with range, language, location, timezone, region and tradition inputs. Coverage distinguishes empty days, fallback language and withheld timing; an empty editorial day does not mean a missing Panchang calculation.

`/events/dated?from=&to=` returns published, non-cancelled events in an inclusive range of at most 800 days. Multiple events on the same day are valid. The editor detects probable duplicates by title/date/type/applicability/scope and requires explicit confirmation to keep one. Readiness also lists same-title/day duplicates.

Applicability is global, tradition, region or location, with a scope key. Non-global records require a matching request scope. English/Hindi title and description must be available together to select Hindi; otherwise the response honestly identifies English fallback. Parana window/after fields are emitted only with an explicit matching `location` and `timezone` and a recorded timing source. Unscoped old timings stay stored but are withheld. `timingWithheld` explains this. All-day descriptions remain available. Clock times are not universal overrides of the location-aware Panchang engine. Cancellation/unpublishing withdraws only the Hub's record; reconciliation and precedence against Android's other sources are specified separately.

## Scripture distribution

Imports lock the scripture, validate all input, and upsert by `(scripture_id, COALESCE(canto,0), chapter, verse)`. Identical imports do not bump versions, including equivalent JSON metadata with different key order. Corrections retain verse UUIDs and daily selections. Missing references are reported with daily/quote dependents. The editor requires a server dependency preview before import; the safe default retains absent references. Deletion requires exact confirmation and no dependents; bulk destructive clear is removed. Published text corrections require explicit reviewed-correction intent. Concurrent expected-version imports cannot both overwrite the same version.

The catalogue adds source metadata, `contentHash`, `hashAlgorithm` and a version/hash download URL. Content stays a bare verse array with snake_case keys. Each immutable stored snapshot contains body, metadata, version and SHA-256. The hash is over the exact uncompressed UTF-8 JSON response bytes. Version/hash URLs that no longer describe the current published snapshot return 409 so the client refreshes the catalogue. Withdrawn texts return 404, even if an old snapshot exists. `X-Scripture-Version`, `X-Content-SHA256` and ETag describe the actual body. Metadata/visibility changes advance the version; source reference keys remain canto-aware.

## Katha and quotes

Each curated story is a Books record with `is_story=true`; its story ID equals book ID. `story_body` is the canonical narrative; existing page text remains captions and illustrated-page context. A book can have zero or more related pages with stable page IDs. A story requires title, summary, readable body, actual cover, source/provenance, themes, references and publication date. Hindi title/summary/body form one complete translation. Reading time is estimated from the selected body. `/stories` returns a paginated feed with a snapshot token; subsequent pages must keep token, locale and page size. `/stories/{id}` includes the body and page links. Changes during pagination return 409. Current Android's local `PuranaStory`/`StoryFeedItem` models are not claimed to be connected.

Quotes are typed `exact_quote`, `translated_scripture` or `original_reflection`. They carry attribution, reference, source/provenance, language, theme, publication state, optional linked verse/schedule and lock-screen eligibility. `/quotes/selection` uses deterministic daily rotation with requested/base/English language fallback and excludes withdrawn linked sources. Quote visibility is always the Android user's setting. A missing remote selection uses the bundled fallback; it does not enable quotes or replace Android layout code.

The legacy Books route also withholds story-backed books before their `published_on` India day. Illustrated story pages declare their own selected caption language and fallback, independent of the narrative.
