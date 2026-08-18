"use client";
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Typography,
} from "@mui/material";

type Decision = "approve" | "reject";

type Props = {
  open: boolean;
  decision: Decision | null;
  title: string;
  subtitle?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reviewComments: string) => Promise<void> | void;
};

export default function RequestReviewDialog({
  open,
  decision,
  title,
  subtitle,
  submitting,
  onClose,
  onConfirm,
}: Props) {
  const [comments, setComments] = useState("");

  useEffect(() => {
    if (open) setComments("");
  }, [open, decision]);

  const confirmLabel = decision === "approve" ? "Approve" : "Reject";
  const confirmColor = decision === "approve" ? "success" : "error";

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        {subtitle && (
          <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
            {subtitle}
          </Typography>
        )}
        <TextField
          label="Review comments (optional)"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          disabled={submitting}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          disabled={submitting || !decision}
          onClick={() => onConfirm(comments.trim())}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
