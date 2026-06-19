// app/rosters/page.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import {
  Box, Button, Typography, Paper,
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, IconButton,
  Chip, Alert, Tooltip, CircularProgress,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import { rosterApi, Roster, getErrorMessage } from "@/lib/api";

export default function RostersPage() {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load rosters on component mount
  useEffect(() => {
    loadRosters();
  }, []);

  const loadRosters = async () => {
    try {
      setLoading(true);
      const data = await rosterApi.list();
      setRosters(data);
    } catch (err) {
      console.error("Failed to load rosters:", err);
      setError("Failed to load rosters. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setError("");
    if (!selected) return;

    const allowed = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
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

  const handleUpload = async () => {
    if (!file) { 
      setError("Please select a file first."); 
      return; 
    }

    try {
      setUploading(true);
      setError("");
      const uploadedRoster = await rosterApi.upload(file);
      setRosters([uploadedRoster, ...rosters]);
      setFile(null);
      setSuccess(`"${file.name}" uploaded successfully!`);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this roster?")) return;
    
    try {
      await rosterApi.remove(id);
      setRosters(rosters.filter((r) => r.id !== id));
      setSuccess("Roster deleted successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 2 }}>
          Roster Management
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="roster-upload"
            disabled={uploading}
          />
          <label htmlFor="roster-upload">
            <Button 
              variant="outlined" 
              component="span" 
              startIcon={<UploadFileIcon />}
              disabled={uploading}
            >
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
            disabled={!file || uploading}
            sx={{ backgroundColor: "#2563eb" }}
          >
            {uploading ? <CircularProgress size={24} /> : "Upload Roster"}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Accepted: .csv, .xlsx, .xls — Max size: 5MB
        </Typography>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#1e293b" }}>
                {["File Name", "Roster ID", "Upload Date", "Status", "Actions"].map((col) => (
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
                  <TableCell colSpan={5} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                    No rosters uploaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                rosters.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>📄 {r.fileName}</TableCell>
                    <TableCell>{r.rosterId}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={r.isActive ? "Active" : "Inactive"}
                        size="small"
                        sx={{
                          backgroundColor: r.isActive ? "#dcfce7" : "#f1f5f9",
                          color: r.isActive ? "#16a34a" : "#64748b",
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
        )}
      </TableContainer>
    </Box>
  );
}
