// app/profile/page.tsx — "My Profile" page (view-only personal + account details)
"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import { authApi, getErrorMessage, ROLE_LABELS, type Employee } from "@/lib/api";

const ROLE_CHIP_SX: Record<string, { backgroundColor: string; color: string }> = {
  "super-admin": { backgroundColor: "#fce7f3", color: "#9d174d" },
  admin: { backgroundColor: "#fef3c7", color: "#b45309" },
  "admin-manager": { backgroundColor: "#e0e7ff", color: "#3730a3" },
  manager: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  employee: { backgroundColor: "#f1f5f9", color: "#64748b" },
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function initialsOf(employee: Employee) {
  const initials = `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase();
  return initials || "?";
}

/** Label-above-value pair used throughout the section cards below. */
function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ color: "#94a3b8", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}
      >
        {label}
      </Typography>
      <Typography variant="body1" sx={{ color: "#0f172a", fontWeight: 500, mt: 0.25 }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}

/** Card wrapper for a group of related InfoFields. */
function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, sm: 3 },
        borderRadius: 2,
        border: "1px solid #e2e8f0",
        height: "100%",
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f172a", mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</Box>
    </Paper>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authApi.me();
      setEmployee(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !employee) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <Alert severity="error">{error || "Unable to load your profile."}</Alert>
      </Box>
    );
  }

  const roleChipSx = ROLE_CHIP_SX[employee.role] ?? ROLE_CHIP_SX.employee;
  const roleLabel = ROLE_LABELS[employee.role] ?? employee.role;
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const hasReportingLine = !!employee.hodEmployee || !!employee.supervisorEmployee;

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header — identity summary */}
      <Paper
        elevation={1}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 2,
          background: "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 3,
        }}
      >
        <Avatar
          sx={{
            width: 72,
            height: 72,
            fontSize: 28,
            fontWeight: 700,
            backgroundColor: "#38bdf8",
            color: "#0f172a",
          }}
        >
          {initialsOf(employee)}
        </Avatar>

        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
            {fullName || "—"}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mt: 1.5 }}>
            <Chip label={roleLabel} size="small" sx={{ fontWeight: 600, ...roleChipSx }} />
            <Chip
              label={employee.isActive ? "Active" : "Inactive"}
              size="small"
              sx={{
                fontWeight: 600,
                backgroundColor: employee.isActive ? "#dcfce7" : "#f1f5f9",
                color: employee.isActive ? "#166534" : "#64748b",
              }}
            />
            <Chip
              label={employee.employeeId}
              size="small"
              variant="outlined"
              sx={{ fontFamily: "monospace", fontWeight: 600, borderColor: "#cbd5e1", color: "#334155" }}
            />
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={<FingerprintIcon />}
          onClick={() =>
            router.push(
              `/mock/punch/system?employeeId=${encodeURIComponent(employee.employeeId)}`,
            )
          }
          aria-label="Record punch card"
          sx={{
            backgroundColor: "#2563eb",
            whiteSpace: "nowrap",
            alignSelf: { xs: "stretch", sm: "center" },
            "&:hover": { backgroundColor: "#1d4ed8" },
          }}
        >
          Punch Card
        </Button>
      </Paper>

      {/* Detail sections */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 3,
        }}
      >
        <SectionCard title="Contact Information">
          <InfoField label="Email" value={employee.email} />
          <InfoField label="Phone" value={employee.phone} />
        </SectionCard>

        <SectionCard title="Employment Details">
          <InfoField label="Department" value={employee.department} />
          <InfoField label="Role" value={roleLabel} />
          <InfoField label="Assigned to Roster" value={employee.roster ? "Yes" : "No"} />
        </SectionCard>

        {hasReportingLine && (
          <SectionCard title="Reporting Line">
            {employee.hodEmployee && (
              <InfoField
                label="Head of Department"
                value={`${employee.hodEmployee.firstName} ${employee.hodEmployee.lastName} · ${
                  ROLE_LABELS[employee.hodEmployee.role] ?? employee.hodEmployee.role
                }`}
              />
            )}
            {employee.supervisorEmployee && (
              <InfoField
                label="Supervisor"
                value={`${employee.supervisorEmployee.firstName} ${employee.supervisorEmployee.lastName} · ${
                  ROLE_LABELS[employee.supervisorEmployee.role] ?? employee.supervisorEmployee.role
                }`}
              />
            )}
          </SectionCard>
        )}

        <SectionCard title="Account">
          <InfoField label="Employee ID" value={employee.employeeId} />
          <InfoField label="Member Since" value={formatDate(employee.createdAt)} />
          <InfoField label="Last Updated" value={formatDate(employee.updatedAt)} />
        </SectionCard>
      </Box>
    </Box>
  );
}