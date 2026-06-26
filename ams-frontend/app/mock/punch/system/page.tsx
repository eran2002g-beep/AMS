"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material";
import { attendanceLogApi, getErrorMessage } from "@/lib/api";

function formatPunchDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPunchTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function MockPunchSystemContent() {
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("employeeId")?.trim() ?? "";
  const punchTypeParam = searchParams.get("punchType");
  const punchType =
    punchTypeParam === "in" || punchTypeParam === "out" ? punchTypeParam : undefined;

  const submittedRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [capturedAt, setCapturedAt] = useState<{ punchDate: string; punchTime: string } | null>(null);
  const [logId, setLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setStatus("error");
      setMessage("Missing employeeId query parameter.");
      return;
    }

    if (submittedRef.current) return;
    submittedRef.current = true;

    const now = new Date();
    const punchDate = formatPunchDate(now);
    const punchTime = formatPunchTime(now);
    setCapturedAt({ punchDate, punchTime });
    setStatus("loading");

    attendanceLogApi
      .create({
        employeeId,
        punchDate,
        punchTime,
        ...(punchType ? { punchType } : {}),
        source: "iot",
      })
      .then((log) => {
        setLogId(log.logId);
        setStatus("success");
        setMessage(`Punch recorded for ${employeeId}.`);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(getErrorMessage(err));
      });
  }, [employeeId, punchType]);

  return (
    <Box sx={{ maxWidth: 520, mx: "auto" }}>
      <Paper sx={{ p: 3, borderRadius: 2 }} elevation={1}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 2 }}>
          Mock Punch System
        </Typography>

        {employeeId && (
          <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
            Employee ID: <strong>{employeeId}</strong>
          </Typography>
        )}

        {capturedAt && (
          <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
            Captured: <strong>{capturedAt.punchDate}</strong> at{" "}
            <strong>{capturedAt.punchTime}</strong>
          </Typography>
        )}

        {status === "loading" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>
            <CircularProgress size={24} />
            <Typography>Recording punch…</Typography>
          </Box>
        )}

        {status === "success" && (
          <Alert severity="success">
            {message}
            {logId && (
              <>
                {" "}
                Log ID: <strong>{logId}</strong>
              </>
            )}
          </Alert>
        )}

        {status === "error" && <Alert severity="error">{message}</Alert>}
      </Paper>
    </Box>
  );
}

export default function MockPunchSystemPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <MockPunchSystemContent />
    </Suspense>
  );
}
