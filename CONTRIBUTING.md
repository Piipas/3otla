# Contributing

Thanks for helping keep Moroccan holiday dates correct.

## Submitting a date correction

All holiday data lives in `packages/data` and is changed through pull requests.

1. **Find the official source first.** Accepted sources:
   - [maroc.ma](https://www.maroc.ma) (national portal)
   - Ministry websites under `*.gov.ma`, such as habous.gov.ma (moon-sighting announcements)
     or men.gov.ma (school calendars)
   - MAP, the official news agency (mapexpress.ma)

   Aggregators, Wikipedia, news and job sites are **not** accepted, even when they are right.
   CI rejects them.
2. **Edit the right file:**
   - Wrong national holiday rule → `packages/data/holidays/national.json`
   - Wrong religious holiday rule → `packages/data/holidays/religious.json`
   - School calendar → `packages/data/school/<calendar>/<YYYY-YYYY>.json`. The source must
     be the Ministry of Education decision (men.gov.ma) or, for French schools, the
     embassy-signed calendar on efmaroc.org. A new school year also needs one import line in
     `packages/data/src/index.ts`.
   - An official announcement of a religious holiday date → add an entry to
     `packages/data/confirmations.json`:

     ```json
     {
       "holidayId": "eid-al-fitr",
       "hijriYear": 1448,
       "date": "2027-03-10",
       "announcedAt": "2027-03-08T19:30:00Z",
       "sourceUrl": "https://www.habous.gov.ma/..."
     }
     ```

3. **Every change must include an official `sourceUrl`.** If a decree applies, add it to
   `decisionRefs`. Never guess a URL or a decree number.
4. Run `pnpm test`. The tests validate the JSON schema, the source allowlist, and that
   a confirmed date is within two days of the Umm al-Qura estimate.
5. Open the PR with a link to the source in the description.

## Code contributions

Read [CLAUDE.md](CLAUDE.md) for conventions. In short: logic goes in `packages/core`,
TypeScript strict, Biome formatting (`pnpm format`), and tests for every behaviour change.

## Licenses

By contributing you agree that code is released under MIT and data under CC BY 4.0.
