import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/employee",
        destination: `${backendUrl}/employee`,
      },
      {
        source: "/employee/:path*",
        destination: `${backendUrl}/employee/:path*`,
      },
      {
        source: "/roster/:path*",
        destination: `${backendUrl}/roster/:path*`,
      },
      {
        source: "/attendance-log/:path*",
        destination: `${backendUrl}/attendance-log/:path*`,
      },
      {
        source: "/attendance/:path*",
        destination: `${backendUrl}/attendance/:path*`,
      },
    ];
  },
};

export default nextConfig;
