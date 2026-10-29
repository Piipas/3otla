import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except the API, API docs, Next internals and files with an extension.
  matcher: ["/((?!api|docs|icon|apple-icon|_next|_vercel|.*\\..*).*)"],
};
