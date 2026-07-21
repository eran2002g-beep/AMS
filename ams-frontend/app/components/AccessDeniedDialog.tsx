"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
};

export default function AccessDeniedDialog({ open, message, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="access-denied-dialog-title"
      aria-describedby="access-denied-dialog-description"
    >
      <DialogTitle id="access-denied-dialog-title" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ReportProblemOutlinedIcon color="error" />
        Access Denied
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="access-denied-dialog-description" sx={{ color: "#334155" }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" color="error">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
