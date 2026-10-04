import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next.js's output file tracing to include directories that the
  // /api/files/[...path] route reads dynamically via fs.readFile. Without
  // this, NFT can't see the static imports and the files don't ship to the
  // container (causing 404s on the deployed app).
  outputFileTracingIncludes: {
    "/api/files/[...path]": [
      "./docs/**/*",
      "./db/seed/lease-fixtures/**/*",
      "./db/seed/om-fixtures/**/*",
      "./db/seed/psa-fixtures/**/*",
    ],
  },
};

export default nextConfig;
