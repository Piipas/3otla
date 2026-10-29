import type { ApiApp } from "../context";
import {
  ContributionSchema,
  type ContributionSink,
  checkContribution,
  issueFor,
} from "../contributions";
import { apiError } from "../errors";

/**
 * POST /api/v1/contributions — used by the website's contribution form.
 * Deliberately left out of the OpenAPI spec, and CORS only allows GET, so browsers on
 * other origins cannot post here.
 */
export function registerContributionRoutes(app: ApiApp, sink: ContributionSink | null) {
  app.post("/v1/contributions", async (c) => {
    if (!sink) {
      return apiError(
        c,
        503,
        "contributions_disabled",
        "Contributions are not configured on this server. Open an issue on GitHub instead.",
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

    try {
      const issue = await sink.create(issueFor(parsed.data, check));
      c.header("Cache-Control", "no-store");
      return c.json({ data: { issue: issue.number, url: issue.url, status: "pending" } }, 201);
    } catch (error) {
      console.error("[contributions] could not create issue", error);
      return apiError(
        c,
        502,
        "upstream_error",
        "Could not record the contribution, try again later.",
      );
    }
  });
}
