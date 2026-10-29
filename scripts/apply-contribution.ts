// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: run by GitHub Actions, not Turborepo
/**
 * Applies an accepted contribution issue to the data (run by .github/workflows/contributions.yml).
 *
 * Reads the issue body from ISSUE_BODY, extracts the JSON payload written by the website
 * (apps/web/src/api/contributions.ts) and, for a confirmation, adds it to
 * packages/data/confirmations.json. Other kinds need a manual change: the script reports
 * `applied=false` and the workflow comments on the issue instead.
 *
 * The workflow then runs the data tests, which re-check the schema, the source allowlist and
 * the ±2-day plausibility rule, before opening a pull request.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { checkSourceUrl } from "../packages/data/src/sources.ts";

const MARKER = "<!-- 3otla-contribution\n";
const FILE = new URL("../packages/data/confirmations.json", import.meta.url);

interface Confirmation {
  holidayId: string;
  hijriYear: number;
  date: string;
  announcedAt: string;
  sourceUrl: string;
}

function output(values: Record<string, string>) {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v.replace(/[\r\n]/g, " ")}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  else console.log(lines.join("\n"));
}

function fail(message: string): never {
  console.error(`apply-contribution: ${message}`);
  process.exit(1);
}

const body = (process.env.ISSUE_BODY ?? "").replace(/\r\n/g, "\n");
const json = body.split(MARKER)[1]?.split("\n-->")[0];
if (!json) fail("no contribution payload in the issue body");

let payload: { version?: number; kind?: string; confirmation?: Confirmation };
try {
  payload = JSON.parse(json);
} catch {
  fail("the contribution payload is not valid JSON");
}
if (payload.version !== 1) fail(`unsupported payload version ${payload.version}`);

if (payload.kind !== "confirmation" || !payload.confirmation) {
  output({ applied: "false", kind: String(payload.kind) });
  process.exit(0);
}

const c = payload.confirmation;
const valid =
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.holidayId) &&
  Number.isInteger(c.hijriYear) &&
  /^\d{4}-\d{2}-\d{2}$/.test(c.date) &&
  !Number.isNaN(Date.parse(c.announcedAt));
if (!valid) fail("the confirmation has invalid fields");
const source = checkSourceUrl(c.sourceUrl);
if (!source.ok) fail(`source rejected: ${source.reason}`);

const file = JSON.parse(readFileSync(FILE, "utf8")) as {
  $schema?: string;
  confirmations: Confirmation[];
};
if (file.confirmations.some((x) => x.holidayId === c.holidayId && x.hijriYear === c.hijriYear)) {
  fail(`${c.holidayId} ${c.hijriYear} is already confirmed`);
}
file.confirmations.push({
  holidayId: c.holidayId,
  hijriYear: c.hijriYear,
  date: c.date,
  announcedAt: c.announcedAt,
  sourceUrl: c.sourceUrl,
});
file.confirmations.sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(FILE, `${JSON.stringify(file, null, 2)}\n`);

output({ applied: "true", summary: `${c.holidayId} ${c.hijriYear} on ${c.date}` });
