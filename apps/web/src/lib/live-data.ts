/**
 * The data the site and API answer with: repository data plus religious-holiday
 * announcements accepted by an admin (stored in Redis, applied live without a deploy).
 *
 * Reads are cached under LIVE_TAG; admin decisions invalidate it (src/lib/admin-actions.ts).
 */
import { type Core, createCore, defaultCore, withConfirmations } from "@3otla/core";
import { type Confirmation, dataset } from "@3otla/data";
import { unstable_cache } from "next/cache";
import { storeFromEnv } from "./contribution-store";

/** Cache tag of everything that depends on accepted contributions (pages and API responses). */
export const LIVE_TAG = "live-data";

const loadLiveConfirmations = unstable_cache(
  async (): Promise<Confirmation[]> => {
    const store = storeFromEnv(process.env);
    if (!store) return [];
    const live = await store.liveConfirmations();
    return live
      .map((l) => l.confirmation)
      .sort((a, b) =>
        `${a.holidayId}:${a.hijriYear}`.localeCompare(`${b.holidayId}:${b.hijriYear}`),
      );
  },
  ["live-confirmations"],
  { tags: [LIVE_TAG], revalidate: 3600 },
);

let memo: { key: string; core: Core } | undefined;

export async function getCore(): Promise<Core> {
  let live: Confirmation[] = [];
  try {
    live = await loadLiveConfirmations();
  } catch (error) {
    // Errors are not cached: the next request tries again. Repository data still answers.
    console.error("[live-data] could not read accepted confirmations", error);
  }
  if (live.length === 0) return defaultCore;
  const key = JSON.stringify(live);
  if (memo?.key !== key) memo = { key, core: createCore(withConfirmations(dataset, live)) };
  return memo.core;
}
