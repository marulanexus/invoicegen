import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      // Allow logos/assets served from common object stores.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
  // @react-pdf/renderer must not be bundled by the RSC compiler; keep server-only.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
