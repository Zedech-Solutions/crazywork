import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (config, { nextRuntime }) => {
    // instrumentation.ts is compiled for both the Node and Edge runtimes. Its
    // dynamic import of the notifier (→ secrets → node:crypto) is guarded to run
    // only under Node, but webpack still bundles it for the Edge build, which
    // can't resolve Node builtins. Stub the module out of the Edge bundle; the
    // Node runtime keeps the real one.
    if (nextRuntime === "edge") {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/lib/integrations/notifier": false,
      };
    }
    return config;
  },
};

export default nextConfig;
