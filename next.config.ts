import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "vecchi.vercel.app" }],
        destination: "https://vecchio.menhir-holdings.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "vecchio-menhir-tech.vercel.app" }],
        destination: "https://vecchio.menhir-holdings.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
