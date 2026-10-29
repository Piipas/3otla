# 3otla (عطلة) — conventions

Moroccan public holidays: website + free public API. Trilingual (ar RTL, fr, en).

## Non-negotiables

- **Git is the holiday database.** Holidays live only in `packages/data` (JSON). No DB, no CMS.
  A data change is a commit; a deploy publishes it.
- **Logic lives in `packages/core`.** The API and the web app call core; they never compute
  dates themselves. Server components import `@3otla/core` directly, never the public API.
- **Every data change needs an official `sourceUrl`** (maroc.ma, `*.gov.ma` such as
  habous.gov.ma / men.gov.ma, MAP). Allowlist in `packages/data/src/sources.ts`, enforced by tests.
- **Never use aggregators** (Calendarific, holidayapi, timeanddate, Wikipedia, news or job
  sites) as a source, even when their date is right.
- **Never invent URLs or decree numbers.** If unsure, use the maroc.ma holidays page and add
  an item to `packages/data/SOURCES_TODO.md`.

## Data model

- `packages/data/holidays/{national,religious}.json`: rules, validated by
  `schema/holidays.schema.json`. `type: "fixed"` = Gregorian month/day,
  `type: "hijri"` = Hijri month/day. `validFrom`/`validTo` bound when a rule applies.
- `packages/data/confirmations.json`: official Habous announcements for Hijri holidays,
  keyed by `(holidayId, hijriYear)`. A confirmation flips status from `estimated` to
  `confirmed` and must be within ±2 days of the Umm al-Qura estimate (tested).
- Status: `fixed` (Gregorian rule), `estimated` (Umm al-Qura via `Intl`; Morocco's moon
  sighting can be +1 day), `confirmed` (announced).
- Occurrence `key` = `id:hijriYear` or `id:gregorianYear`. It is stable when a date is
  confirmed (used as .ics UID). A Gregorian year can hold two occurrences of a Hijri holiday.
- Supported years: `SUPPORTED_YEARS` in `packages/core/src/resolve.ts` (2024–2035).
- School calendars: `packages/data/school/<calendar>/<YYYY-YYYY>.json` (`school-public`,
  `school-aefe`), one file per school year, registered in `packages/data/src/index.ts`.
  Breaks are inclusive days off; breaks tied to Eid are Hijri ranges that move with the
  Eid's confirmation. **School breaks are not public holidays**: they never feed
  `isHoliday` or `workdays` (`packages/core/src/school.ts`).

## Code conventions

- TypeScript strict everywhere, `noUncheckedIndexedAccess`. Biome for lint + format
  (`pnpm format`). Double quotes, 2 spaces, 100 cols.
- Dates are `"YYYY-MM-DD"` strings (`IsoDate`), never `Date` objects with times. Day math
  goes through `packages/core/src/date.ts`. "Today" is `todayInCasablanca()`.
- `packages/core` has zero runtime dependencies besides `@3otla/data`. Uses only `Intl`.
- Invalid input throws `HolidayError` with a stable `code`; the API maps codes to HTTP errors.
- Web: Tailwind logical properties only (`ms-`, `pe-`, `start-`), never `ml-`/`pr-`/`left-`.

## Public API (`apps/web/src/api`)

- Hono + `@hono/zod-openapi`, mounted at `app/api/[[...route]]/route.ts` (Node runtime).
  `createApi(options)` takes the clock, base URL and limiter so tests can inject them.
- Every error is `{ error: { code, message, details?, docs } }` with `Cache-Control: no-store`.
  `HolidayError` codes from core map to 400.
- Cache profiles in `cache.ts`: `static` for date-addressed answers, `today` for anything
  depending on the current date, `ics` for feeds. ETags come from `hono/etag`.
- Rate limiting (`ratelimit.ts`) runs at the origin and fails open. `X-RateLimit-*` headers
  are only set on responses the CDN won't share (errors, 429).
- The OpenAPI spec is generated from the route schemas; `/docs` renders it with Scalar.

## Website (`apps/web/app/[locale]`)

- next-intl with `/ar`, `/fr`, `/en` (always prefixed). Strings live in `apps/web/messages/*.json`;
  keep the three files in sync. Arabic plurals need all ICU categories.
- Dates are formatted with `INTL_LOCALE` (`ar-MA` gives Moroccan month names with Latin digits).
- Theme tokens are CSS variables in `src/styles/globals.css` (`bg-bg`, `text-ink`, `bg-brand`,
  `text-estimated`, …). Use them instead of raw Tailwind colours. Status colours have meaning:
  fixed = ink, estimated = saffron, confirmed = green.
- Pages are statically generated (last year to two years ahead) and fall back to on-demand
  rendering for other supported years. Home revalidates hourly because "next holiday" depends
  on today. Anything "today"-dependent in a static page must be computed on the client
  (`Countdown`, `TodayMarker`).
- OG images use Satori, which neither shapes Arabic nor reorders RTL text: pass every string
  through `toVisual` (`src/lib/arabic-shaping.ts`).
- E2E: `pnpm --filter @3otla/web build && pnpm --filter @3otla/web e2e` (Playwright).

## Commands

```bash
pnpm install
pnpm test        # vitest in every package
pnpm typecheck
pnpm lint        # biome check
pnpm format      # biome check --write
```

Update the .ics snapshot only when the output change is intended:
`pnpm --filter @3otla/core exec vitest run -u`.
