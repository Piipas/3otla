import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  transpilePackages: ["@3otla/core", "@3otla/data"],
  poweredByHeader: false,
  // OG images read their fonts from disk at request time (ISR); make sure they ship.
  outputFileTracingIncludes: { "/[locale]/**": ["./assets/fonts/**"] },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(config);
