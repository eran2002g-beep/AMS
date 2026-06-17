import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/employee/:path*",
        destination: "http://localhost:3000/employee/:path*",
      },
    ];
  },
};

export default nextConfig;
