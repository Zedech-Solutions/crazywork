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
  webpack: (config, { nextRuntime, webpack }) => {
    // instrumentation.ts is compiled for both the Node and Edge runtimes. Its
    // dynamic import of the notifier (→ secrets → node:crypto) is guarded to run
    // only under Node, but webpack still bundles it for non-Node runtimes, which
    // can't resolve Node builtins. Drop it from every non-Node bundle; the Node
    // runtime keeps the real module.
    if (nextRuntime !== "nodejs") {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /lib\/integrations\/notifier$/,
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
