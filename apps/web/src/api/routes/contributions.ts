import type { ContributionStore } from "@/lib/contribution-store";
import type { ApiApp } from "../context";
import { ContributionSchema, checkContribution } from "../contributions";
import { apiError } from "../errors";

/**
 * POST /api/v1/contributions — used by the website's contribution form. The contribution
 * is stored as pending until an admin accepts or rejects it on /admin.
 * Deliberately left out of the OpenAPI spec, and CORS only allows GET, so browsers on
 * other origins cannot post here.
 */
export function registerContributionRoutes(app: ApiApp, store: ContributionStore | null) {
  app.post("/v1/contributions", async (c) => {
    if (!store) {
      return apiError(
        c,
        503,
        "contributions_disabled",
        "Contributions are not available right now. Try again later.",
      );
    }

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return apiError(c, 400, "invalid_request", "Body must be JSON");
    }
    const parsed = ContributionSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return apiError(c, 400, "invalid_request", "Invalid contribution", details);
    }

    const check = checkContribution(parsed.data);
    if (!check.ok) return apiError(c, 422, check.code, check.message);

    const { website: _honeypot, ...contribution } = parsed.data;
    try {
      const saved = await store.add({
        contribution,
        ...(check.confirmation ? { confirmation: check.confirmation } : {}),
      });
      c.header("Cache-Control", "no-store");
      return c.json({ data: { id: saved.id, status: saved.status } }, 201);
    } catch (error) {
      console.error("[contributions] could not store contribution", error);
      return apiError(
        c,
        502,
        "upstream_error",
        "Could not record the contribution, try again later.",
      );
    }
  });
}
