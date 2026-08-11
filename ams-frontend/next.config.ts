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
      {
        // Covers /leave/submit, /leave/me, /leave/queue, /leave/employee/:id,
        // /leave/:id/approve|reject. Bare GET /leave and /leave/review stay as
        // Next.js pages (filesystem takes precedence over rewrites).
        source: "/leave/:path*",
        destination: `${backendUrl}/leave/:path*`,
      },
      {
        // Covers /unauthorised/submit, /unauthorised/me, /unauthorised/queue,
        // /unauthorised/employee/:id, /unauthorised/:id/approve|reject.
        // /unauthorised/review is a Next.js page (filesystem wins).
        source: "/unauthorised/:path*",
        destination: `${backendUrl}/unauthorised/:path*`,
      },
    ];
  },
};

export default nextConfig;