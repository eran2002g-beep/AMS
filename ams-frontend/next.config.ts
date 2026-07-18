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
        source: "/employee/create",
        destination: `${backendUrl}/employee/create`,
      },
      {
        // Single-segment paths only (e.g. /employee/EMP001) — does not match /employee/attendance/*
        source: "/employee/:employeeId",
        destination: `${backendUrl}/employee/:employeeId`,
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