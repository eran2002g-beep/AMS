"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import type { AccessDeniedReason } from "@/lib/api";

type Props = {
  open: boolean;
  message: string;
  reason?: AccessDeniedReason;
  onClose: () => void;
};

export default function AccessDeniedDialog({
  open,
  message,
  reason = "forbidden",
  onClose,
}: Props) {
  const title = reason === "unauthenticated" ? "Session Expired" : "Access Denied";
  const actionLabel = reason === "unauthenticated" ? "Sign In" : "Back to Dashboard";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="access-denied-dialog-title"
      aria-describedby="access-denied-dialog-description"
    >
      <DialogTitle id="access-denied-dialog-title" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ReportProblemOutlinedIcon color="error" />
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="access-denied-dialog-description" sx={{ color: "#334155" }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" color="error">
          {actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
