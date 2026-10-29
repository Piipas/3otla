import { handle } from "hono/vercel";
import { createApi } from "@/api/app";
import { githubSinkFromEnv } from "@/api/contributions";
import { limiterFromEnv } from "@/api/ratelimit";

// Intl's Umm al-Qura calendar and the Upstash client run on Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const app = createApi({
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL,
  dataVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  limiter: limiterFromEnv(process.env),
  contributions: githubSinkFromEnv(process.env),
});

const handler = handle(app);

export { handler as GET, handler as HEAD, handler as OPTIONS, handler as POST };
