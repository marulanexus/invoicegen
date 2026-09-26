import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@invoicegen/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      // Allow logos/assets served from common object stores.
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
  // @react-pdf/renderer must not be bundled by the RSC compiler; keep server-only.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
