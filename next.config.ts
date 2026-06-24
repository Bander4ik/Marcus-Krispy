import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Anthropic SDK external to the server bundle so its Node-only bits
  // (streams, fetch shims) load at runtime rather than being bundled by Turbopack.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
