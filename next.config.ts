import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // frame-ancestors 'self' (not DENY): the admin pages-builder previews
          // the site in an iframe.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
  images: {
    // Vercel image-optimization quota is exhausted on the current plan —
    // optimized requests 402 in prod. Serve originals directly (uploads are
    // pre-compressed client-side, see components/admin/api.ts). Remove this
    // when upgrading to Pro or switching to a Cloudflare resizing loader.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
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
