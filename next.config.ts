import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  // Server-side maps are not officially toggle-controlled by Next 16;
  // we strip them in the Docker builder stage as a belt-and-braces step
  // (see Dockerfile).
};

export default nextConfig;
