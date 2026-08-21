// app/dashboard/page.tsx — shared home for every authenticated role
"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, leaveApi, unauthorisedApi } from "@/lib/api";
import { canManageLeave } from "@/lib/roles";

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const manageLeave = canManageLeave(user?.role);
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || "User"
    : "User";
  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";

  const [leaveAwaiting, setLeaveAwaiting] = useState<number | null>(null);
  const [unauthAwaiting, setUnauthAwaiting] = useState<number | null>(null);

  const loadReviewCounts = useCallback(async () => {
    if (!manageLeave) return;
    try {
      const [leaveResult, unauthResult] = await Promise.all([
        leaveApi.getQueue({ status: "awaiting", limit: 1 }),
        unauthorisedApi.getQueue({ status: "awaiting", limit: 1 }),
      ]);
      setLeaveAwaiting(leaveResult.meta.total);
      setUnauthAwaiting(unauthResult.meta.total);
    } catch {
      setLeaveAwaiting(null);
      setUnauthAwaiting(null);
    }
  }, [manageLeave]);

  useEffect(() => {
    loadReviewCounts();
  }, [loadReviewCounts]);

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Paper
        elevation={1}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 2,
          background: "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
          border: "1px solid #e2e8f0",
          mb: manageLeave ? 3 : 0,
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: "#0f172a", mb: 1, letterSpacing: "-0.02em" }}
        >
          Welcome {displayName}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 500, color: "#64748b" }}>
          {roleLabel}
        </Typography>
      </Paper>

      {manageLeave && (
        <Stack spacing={2}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1e293b" }}>
                Unauthorised requests
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                {unauthAwaiting == null
                  ? "Assigned to you as supervisor or HOD"
                  : unauthAwaiting === 0
                    ? "No unauthorised requests waiting for your review"
                    : `${unauthAwaiting} assigned request${unauthAwaiting === 1 ? "" : "s"} waiting for your review`}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => router.push("/unauthorised/review")}
              sx={{ backgroundColor: "#1e293b", "&:hover": { backgroundColor: "#0f172a" } }}
            >
              Review
            </Button>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1e293b" }}>
                Leave requests
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                {leaveAwaiting == null
                  ? "Assigned to you as supervisor or HOD"
                  : leaveAwaiting === 0
                    ? "No leave requests waiting for your review"
                    : `${leaveAwaiting} assigned request${leaveAwaiting === 1 ? "" : "s"} waiting for your review`}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => router.push("/leave/review")}
              sx={{ backgroundColor: "#1e293b", "&:hover": { backgroundColor: "#0f172a" } }}
            >
              Review
            </Button>
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
