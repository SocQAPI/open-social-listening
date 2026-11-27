import type { NextConfig } from "next";

// OSL_STATIC_DEMO=1 builds the read-only demo for GitHub Pages (scripts/build-demo.mjs): a static export
// whose API runs in the browser on sql.js. Every other build is the normal self-hosted server.
const staticDemo = process.env.OSL_STATIC_DEMO === "1";
const basePath = process.env.OSL_BASE_PATH ?? "";

const serverConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // The libsql driver ships native bindings; keep it out of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

const staticDemoConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // Only .tsx files are routes, which leaves out the API route handlers, proxy.ts and instrumentation.ts.
  pageExtensions: ["tsx"],
  env: { NEXT_PUBLIC_OSL_STATIC_DEMO: "1", NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: {
    resolveAlias: {
      "@/lib/bootstrap": "./lib/demo/static-bootstrap.ts",
      nodemailer: "./lib/demo/empty-module.ts",
    },
  },
};

export default staticDemo ? staticDemoConfig : serverConfig;
