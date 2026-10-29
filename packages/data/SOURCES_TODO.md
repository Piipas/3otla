# Sources to verify manually

Each item below is a placeholder or an assumption that must be checked against an
official source. Never "fix" these from aggregators, news or job sites.

## National holidays

- [ ] **All national entries** point to the maroc.ma holidays page. If a more specific
  official text exists (decree in the Bulletin Officiel, sgg.gov.ma), link it instead.
- [ ] **Unity Day (Oct 31)**: decree refs `2.25.1140` (public sector) and `2.26.14`
  (private sector) were supplied by the maintainer. Add the official URL of each decree
  (`decisionRefs[].url`) and confirm the maroc.ma page lists Oct 31.
- [ ] **Unity Day `validFrom: 2026-01-01`**: confirm the first year of observance.
- [ ] **Amazigh New Year `validFrom: 2024-01-01`**: confirm it was first observed on
  14 Jan 2024.
- [ ] **`validFrom: 2024-01-01` on every other holiday** is a floor ("valid since at least"),
  matching the start of the supported range. It is not the historical start date.

## Religious holidays

- [ ] Confirm durations: Mawlid 2 days, Eid al-Fitr 2 days, Eid al-Adha 2 days,
  1 Muharram 1 day.
- [ ] Optional: add Habous confirmations for the 2026 dates already past
  (Eid al-Fitr 1447, Eid al-Adha 1447, 1 Muharram 1448, Mawlid 1448) so history
  shows "confirmed" instead of "estimated".

## School calendars (2026-2027)

- [x] Public schools: MEN decision 047.26 (3 July 2026), Annex 1, read from the official PDF
  on men.gov.ma. Five fixed breaks plus the Eid al-Fitr (29 Ramadan – 2 Shawwal) and
  Eid al-Adha (9 – 11 Dhu al-Hijja) breaks, which are Umm al-Qura estimates until the
  Eids are confirmed.
- [ ] The MEN Eid al-Fitr break is "3 or 4 days" depending on whether Ramadan has 29 or 30
  days. Once Habous confirms Eid al-Fitr 1448, add the confirmation and check the break
  dates on /school.
- [ ] Every new school year: add `school/<calendar>/<YYYY-YYYY>.json` and register it in
  `src/index.ts`.
