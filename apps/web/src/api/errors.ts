import { HolidayError } from "@3otla/core";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const DOCS_URL = "/docs";

export type ApiErrorCode =
  | HolidayError["code"]
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "invalid_source"
  | "implausible_date"
  | "contributions_disabled"
  | "upstream_error"
  | "internal";

export function errorBody(code: ApiErrorCode, message: string, details?: unknown) {
  return {
    error: { code, message, ...(details === undefined ? {} : { details }), docs: DOCS_URL },
  };
}

export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  c.header("Cache-Control", "no-store");
  return c.json(errorBody(code, message, details), status);
}

/** Maps any thrown error to the consistent error shape. */
export function handleError(err: Error, c: Context) {
  if (err instanceof HolidayError) {
    return apiError(c, err.code === "unknown_school_year" ? 404 : 400, err.code, err.message);
  }
  console.error("[api] unhandled error", err);
  return apiError(c, 500, "internal", "Internal server error");
}
