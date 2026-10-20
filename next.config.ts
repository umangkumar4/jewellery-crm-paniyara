import type { NextConfig } from "next";

// Cache Components (PPR) is Next.js 16's new default caching model: pages are
// static-by-default and any dynamic/auth-gated read needs an explicit
// Suspense boundary or "use cache" directive. This app is an internal,
// always-authenticated CRM/POS where almost every page is request-specific
// (dashboard totals, invoice ledgers, session-gated routes) - there's nothing
// to statically prerender. Disabling it reverts to the classic model: pages
// and Route Handlers are dynamic by default, no Suspense choreography needed
// just to read a cookie. Revisit if a genuinely static/public page is added.
const nextConfig: NextConfig = {
  // Required for Tailwind v4's `@theme` at-rule to parse under Turbopack
  // (Next 16 builds with Turbopack by default; there is no postcss.config).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
