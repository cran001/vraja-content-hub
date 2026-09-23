# Working-tree change manifest

Branch: `feat/dashboard-sections`. This is the current review inventory, not a claim that all diff lines were authored in this task. The starting tree was already dirty. Existing dashboard/sidebar/styles/requests/tsconfig changes, untracked scripture/daily/calendar implementations and migrations were preserved and extended. `.zcode/` is pre-existing and excluded from this inventory. Ignored dependency/build/disposable-DB directories are not delivery files.

The three new migrations are 1787356806000, 1787356807000 and 1787356808000. The four earlier untracked content migrations are historical work and must be reviewed against each environment's migration registry. No changes were committed or pushed.

## Modified tracked files

| File | Starting state |
|---|---|
| `.gitignore` | Tracked file modified during implementation |
| `eslint.config.mjs` | Tracked file modified during implementation |
| `package-lock.json` | Tracked file modified during implementation |
| `package.json` | Tracked file modified during implementation |
| `scripts/seed-admin.js` | Tracked file modified during implementation |
| `src/app/api/admin/book-pages/route.ts` | Tracked file modified during implementation |
| `src/app/api/admin/books/route.ts` | Tracked file modified during implementation |
| `src/app/api/admin/categories/route.ts` | Tracked file modified during implementation |
| `src/app/api/admin/test/route.ts` | Tracked file modified during implementation |
| `src/app/api/admin/wallpapers/route.ts` | Tracked file modified during implementation |
| `src/app/api/auth/login/route.ts` | Tracked file modified during implementation |
| `src/app/api/health/route.ts` | Tracked file modified during implementation |
| `src/app/api/v1/books/route.ts` | Tracked file modified during implementation |
| `src/app/api/v1/darshan/route.ts` | Tracked file modified during implementation |
| `src/app/api/v1/events/route.ts` | Tracked file modified during implementation |
| `src/app/api/v1/sponsors/route.ts` | Tracked file modified during implementation |
| `src/app/api/v1/wallpapers/route.ts` | Tracked file modified during implementation |
| `src/app/dashboard/page.tsx` | Already modified; preserved and extended |
| `src/app/globals.css` | Already modified; preserved and extended |
| `src/components/dashboard/BookCreateForm.tsx` | Tracked file modified during implementation |
| `src/components/dashboard/BookPagesEditor.tsx` | Tracked file modified during implementation |
| `src/components/dashboard/BooksManager.tsx` | Tracked file modified during implementation |
| `src/components/dashboard/BulkUploader.tsx` | Tracked file modified during implementation |
| `src/components/dashboard/CategoryManager.tsx` | Tracked file modified during implementation |
| `src/components/dashboard/DarshanUploader.tsx` | Tracked file modified during implementation |
| `src/components/dashboard/EventsScheduler.tsx` | Tracked file modified during implementation |
| `src/components/dashboard/GalleryTab.tsx` | Tracked file modified during implementation |
| `src/components/dashboard/Sidebar.tsx` | Already modified; preserved and extended |
| `src/components/dashboard/SponsorManager.tsx` | Tracked file modified during implementation |
| `src/context/AuthContext.tsx` | Tracked file modified during implementation |
| `src/lib/db.ts` | Tracked file modified during implementation |
| `src/middleware.ts` | Tracked file modified during implementation |
| `src/requests.http` | Already modified; preserved and extended |
| `tsconfig.json` | Already modified; preserved and extended |

## Untracked delivery files

| File | Note |
|---|---|
| `docs/ANDROID-FOLLOW-UP.md` | Contract, fixture or handoff artifact |
| `docs/API-CONTRACT.md` | Contract, fixture or handoff artifact |
| `docs/CHANGE-MANIFEST.md` | Contract, fixture or handoff artifact |
| `docs/DEPLOYMENT-CHECKLIST.md` | Contract, fixture or handoff artifact |
| `docs/IMPLEMENTATION-STATUS.md` | Contract, fixture or handoff artifact |
| `docs/editorial-library-90-day-drafts.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/books-empty.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/capabilities.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/categories-empty.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/category-inactive-subtree.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/category-tree.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/daily-en-scheduled-correction.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/daily-hi-regional-fallback.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/daily-mr-english-fallback.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/darshan-empty.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/events-parana-window-and-after.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/events-timing-withheld.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/festival-art-empty.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/invalid-request.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/manifest.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/quote-fallback.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/quote-unavailable.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/scripture-body.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/scripture-catalogue.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/scripture-two-cantos-catalogue.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/scripture-two-cantos.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/server-failure.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/sponsors-empty.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/stale-snapshot.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/stories-empty.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/story-detail.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/story-feed-english-fallback.json` | Contract, fixture or handoff artifact |
| `docs/fixtures/wallpapers.json` | Contract, fixture or handoff artifact |
| `docs/openapi.json` | Contract, fixture or handoff artifact |
| `migrations/1787356802000_create-dated-events-table.js` | Existing untracked work preserved |
| `migrations/1787356803000_create-scriptures-table.js` | Existing untracked work preserved |
| `migrations/1787356804000_create-scripture-verses-table.js` | Existing untracked work preserved |
| `migrations/1787356805000_create-daily-verses-table.js` | Existing untracked work preserved |
| `migrations/1787356806000_content-integrity.js` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `migrations/1787356807000_editorial-contracts.js` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `migrations/1787356808000_stories-and-quotes.js` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `scripts/inspect-local-inventory.mjs` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `scripts/seed-daily-verses.mjs` | Existing untracked work preserved |
| `scripts/test-disposable.mjs` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `scripts/verify-api-fixtures.mjs` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `scripts/verify-content-contracts.mts` | Existing untracked work preserved |
| `scripts/verify-daily-verse-api.mjs` | Existing untracked work preserved |
| `scripts/verify-disposable-http.mjs` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/calendar-preview/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/contributions/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/daily-preview/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/daily-verses/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/dated-events/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/editorial/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/me/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/media-cleanup/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/quotes/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/readiness/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/scripture-verses/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/scriptures/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/admin/stories/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/capabilities/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/v1/daily-verse/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/v1/events/dated/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/v1/quotes/selection/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/v1/scriptures/[id]/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/v1/scriptures/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/v1/stories/[id]/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/v1/stories/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/app/api/v1/wallpaper-categories/route.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/components/dashboard/DailyVersesManager.tsx` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/components/dashboard/DatedEventForm.tsx` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/components/dashboard/DatedEventsManager.tsx` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/components/dashboard/EditorialWorkbench.tsx` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/components/dashboard/ScriptureForm.tsx` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/components/dashboard/ScriptureVersesEditor.tsx` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/components/dashboard/ScripturesManager.tsx` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/components/dashboard/StoryQuoteEditors.tsx` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/admin.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/api.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/contentFields.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/dailySelection.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/dailyVerses.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/datedEvents.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/editorial.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/eventSelection.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/httpJson.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/media.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/mediaUpload.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/readiness.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/scriptureImport.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/scriptureSnapshots.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/scriptures.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/stories.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `src/lib/uploadKey.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
| `tests/integration.test.ts` | Local implementation / handoff; some scripture, daily and calendar files extend pre-existing untracked work |
