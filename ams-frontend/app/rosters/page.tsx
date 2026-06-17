// app/rosters/page.tsx
"use client";
import { useState, useRef } from "react";
import {
  Box, Button, Typography, Paper,
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, IconButton,
  Chip, Alert, Tooltip,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";

type Roster = { id: number; filename: string; uploadedOn: string; status: string };

const DUMMY_ROSTERS: Roster[] = [
  { id: 1, filename: "june_roster.csv", uploadedOn: "2024-06-01", status: "Active" },
  { id: 2, filename: "may_roster.xlsx", uploadedOn: "2024-05-01", status: "Archived" },
];

export default function RostersPage() {
  const [rosters, setRosters] = useState<Roster[]>(DUMMY_ROSTERS);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setError("");
    if (!selected) return;

    const allowed = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!allowed.includes(selected.type)) {
      setError("Only .csv or .xlsx files are allowed.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("File size must be under 5MB.");
      return;
    }
    setFile(selected);
  };

  const handleUpload = () => {
    if (!file) { setError("Please select a file first."); return; }

    const newRoster: Roster = {
      id: Date.now(),
      filename: file.name,
      uploadedOn: new Date().toISOString().split("T")[0],
      status: "Active",
    };
    setRosters([newRoster, ...rosters]);
    setFile(null);
    setSuccess(`"${file.name}" uploaded successfully!`);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this roster?")) return;
    setRosters(rosters.filter((r) => r.id !== id));
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 2 }}>
          Roster Management
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="roster-upload"
          />
          <label htmlFor="roster-upload">
            <Button variant="outlined" component="span" startIcon={<UploadFileIcon />}>
              Choose File
            </Button>
          </label>
          {file && (
            <Typography variant="body2" color="text.secondary">
              📄 {file.name}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={handleUpload}
            sx={{ backgroundColor: "#2563eb" }}
          >
            Upload Roster
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Accepted: .csv, .xlsx — Max size: 5MB
        </Typography>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#1e293b" }}>
              {["File Name", "Uploaded On", "Status", "Actions"].map((col) => (
                <TableCell
                  key={col}
                  sx={{ color: "#fff", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase" }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rosters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                  No rosters uploaded yet.
                </TableCell>
              </TableRow>
            ) : (
              rosters.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>📄 {r.filename}</TableCell>
                  <TableCell>{r.uploadedOn}</TableCell>
                  <TableCell>
                    <Chip
                      label={r.status}
                      size="small"
                      sx={{
                        backgroundColor: r.status === "Active" ? "#dcfce7" : "#f1f5f9",
                        color: r.status === "Active" ? "#16a34a" : "#64748b",
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete Roster">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(r.id)}
                        sx={{ color: "#ef4444" }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
