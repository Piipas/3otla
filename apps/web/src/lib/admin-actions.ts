"use server";

import { dataset } from "@3otla/data";
import { invalidateByTag } from "@vercel/functions";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CDN_TAG } from "@/api/cache";
import { routing } from "@/i18n/routing";
import { currentAdmin } from "./admin-session";
import { STATUSES, type StoredContribution, StoreError, storeFromEnv } from "./contribution-store";
import { LIVE_TAG } from "./live-data";

const DECISIONS = ["accepted", "rejected", "revert"] as const;

const pick = <T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
) => (allowed.includes(value as T) ? (value as T) : fallback);

/** Makes a change to accepted announcements visible: pages, cached data and the CDN. */
async function publishLiveChange() {
  updateTag(LIVE_TAG);
  revalidatePath("/", "layout");
  try {
    await invalidateByTag(CDN_TAG);
  } catch (error) {
    // Only available on Vercel; API responses then refresh within their cache lifetime.
    console.warn("[admin] could not purge the CDN cache", error);
  }
}

/** Accept, reject or revert a contribution. Only allowlisted admins (checked server-side). */
export async function decideContribution(formData: FormData): Promise<void> {
  const locale = pick(formData.get("locale"), routing.locales, routing.defaultLocale);
  const tab = pick(formData.get("tab"), STATUSES, "pending");
  const base = `/${locale}/admin?status=${tab}`;

  const admin = await currentAdmin();
  if (!admin) redirect(`/${locale}/admin?error=forbidden`);
  const store = storeFromEnv(process.env);
  if (!store) redirect(`${base}&error=store`);

  const id = String(formData.get("id") ?? "");
  const decision = pick(formData.get("decision"), DECISIONS, "rejected");
  if (!/^[a-f0-9]{12}$/.test(id) || !DECISIONS.includes(formData.get("decision") as never)) {
    redirect(`${base}&error=not_found`);
  }
  const note = String(formData.get("note") ?? "").slice(0, 500);

  let item: StoredContribution;
  let failure: string | null = null;
  try {
    if (decision === "revert") {
      item = await store.revert(id, admin);
    } else {
      if (decision === "accepted") {
        const current = await store.get(id);
        const c = current?.confirmation;
        if (
          c &&
          dataset.confirmations.some(
            (x) => x.holidayId === c.holidayId && x.hijriYear === c.hijriYear,
          )
        ) {
          throw new StoreError("already_confirmed", "Already confirmed in the repository data");
        }
      }
      item = await store.decide(id, decision, admin, note);
    }
    if (item.confirmation && decision !== "rejected") await publishLiveChange();
  } catch (error) {
    if (!(error instanceof StoreError)) {
      console.error("[admin] decision failed", error);
      failure = "generic";
    } else {
      failure = error.code;
    }
  }
  // redirect() throws, so it stays outside the try block.
  redirect(failure ? `${base}&error=${failure}` : `${base}&done=${decision}`);
}
