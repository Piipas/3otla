# 3otla · عطلة

Moroccan public holidays (national and religious), in Arabic, French and English, with
a free and open public API. Every date shows its status and its official source.

- **fixed**: Gregorian holiday, date is certain.
- **estimated**: religious holiday computed with the Umm al-Qura calendar. Morocco
  follows local moon sighting, so the real date can be one day later.
- **confirmed**: announced officially by the Ministry of Habous.

## Public API

Open, no API key. Base URL: `https://3otla.vercel.app/api/v1`. Full docs at `/docs`,
OpenAPI spec at `/api/openapi.json`.

```bash
# All holidays of 2027, French labels
curl "https://3otla.vercel.app/api/v1/holidays?year=2027&lang=fr"

# Only religious holidays
curl "https://3otla.vercel.app/api/v1/holidays?year=2027&calendar=religious"

# Next 3 holidays
curl "https://3otla.vercel.app/api/v1/holidays/next?count=3"

# Is this date a holiday?
curl "https://3otla.vercel.app/api/v1/is-holiday/2026-11-18"

# Working days between two dates (Sat/Sun weekend, holidays excluded)
curl "https://3otla.vercel.app/api/v1/workdays?from=2026-11-01&to=2026-11-30"

# Hijri date (Umm al-Qura)
curl "https://3otla.vercel.app/api/v1/hijri/2027-05-16"

# Subscribable calendar feed (Google Calendar, Apple Calendar, Outlook)
curl "https://3otla.vercel.app/api/v1/calendars/national.ics"
```

Rate limits protect against abuse only: 60 requests/minute and 2000/day per IP.

## Repository

| Path            | What                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| `packages/data` | Holiday rules and official confirmations (JSON + JSON Schema). Git is the database. |
| `packages/core` | Pure TypeScript engine: resolve holidays, Hijri conversion, workdays, .ics.         |
| `apps/web`      | Next.js site and the public API.                                                    |

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
```

### Using the core package

```ts
import { isHoliday, nextHolidays, resolveHolidays, workdays } from "@3otla/core";

resolveHolidays(2027, ["religious"]);
isHoliday("2026-10-31"); // { isHoliday: true, isWeekend: true, holidays: [Unity Day] }
nextHolidays("2026-10-29", 3);
workdays("2026-11-01", "2026-11-30");
```

## Contributing

Spotted a wrong date? See [CONTRIBUTING.md](CONTRIBUTING.md). Every change needs an
official source.

## License

Code: [MIT](LICENSE). Data (`packages/data`): [CC BY 4.0](packages/data/LICENSE).
