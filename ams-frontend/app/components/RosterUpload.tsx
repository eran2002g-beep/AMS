// components/RosterUpload.tsx
"use client";
import { useState, useRef } from "react";
import {
  Box, Button, Typography, Paper, Alert
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CircularProgress from "@mui/material/CircularProgress";
import { rosterApi, getErrorMessage } from "@/lib/api";

type RosterUploadProps = {
  onUploadSuccess: () => void;
  onError: (error: string) => void;
};

export default function RosterUpload({ onUploadSuccess, onError }: RosterUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setSuccess("");
    if (!selected) return;

    // Allow CSV and Excel formats
    const allowed = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ];

    if (!allowed.includes(selected.type)) {
      onError("Only .csv or .xlsx files are allowed.");
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      onError("File size must be under 5MB.");
      return;
    }

    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      onError("Please select a file first.");
      return;
    }

    try {
      setUploading(true);
      await rosterApi.upload(file);
      setSuccess(`"${file.name}" uploaded successfully!`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setSuccess(""), 4000);
      onUploadSuccess();
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b", mb: 2 }}>
        📤 Upload Roster
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: "none" }}
          id="roster-upload-input"
          disabled={uploading}
        />
        <label htmlFor="roster-upload-input">
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
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
            📄 {file.name}
          </Typography>
        )}

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!file || uploading}
          sx={{ backgroundColor: "#2563eb" }}
        >
          {uploading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} color="inherit" />
              Uploading...
            </Box>
          ) : (
            "Upload Roster"
          )}
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        Supported formats: .csv, .xlsx, .xls — Max size: 5MB
        <br />
        <strong>Required columns:</strong> employeeId, date, shiftStart, shiftEnd
      </Typography>
    </Paper>
  );
}
