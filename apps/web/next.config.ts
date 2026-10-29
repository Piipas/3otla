import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@3otla/core", "@3otla/data"],
  poweredByHeader: false,
};

export default config;
