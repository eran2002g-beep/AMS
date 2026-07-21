import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Login, rotating refresh, and logout session endpoints.
        source: "/auth/:path*",
        destination: `${backendUrl}/auth/:path*`,
      },
      {
        source: "/employee",
        destination: `${backendUrl}/employee`,
      },
      {
        // Covers /employee/create, /employee/managers, /employee/:id, /employee/:id/hierarchy, etc.
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