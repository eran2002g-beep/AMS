// app/layout.tsx
import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import Navbar from "./components/Navbar";
import DatePickerProvider from "./components/DatePickerProvider";
import { AuthProvider } from "./lib/auth";
import AuthGuard from "./components/AuthGuard";

export const metadata: Metadata = {
  title: "AMS - Employee Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: "#f5f5f5" }}>
        <AppRouterCacheProvider>
          <DatePickerProvider>
            <AuthProvider>
              <Navbar />
              <main style={{ padding: "24px" }}>
                <AuthGuard>{children}</AuthGuard>
              </main>
            </AuthProvider>
          </DatePickerProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}