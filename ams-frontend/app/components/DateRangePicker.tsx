"use client";

import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  formatDateRangeLabel,
  formatIsoDate,
  getPresetDateRange,
  parseIsoDate,
  type DateRangePreset,
} from "@/lib/dateUtils";

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
];

type Props = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  disabled?: boolean;
  showPresets?: boolean;
  helperText?: string;
};

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
  showPresets = true,
  helperText,
}: Props) {
  const handleStartChange = (value: ReturnType<typeof parseIsoDate>) => {
    const nextStart = formatIsoDate(value);
    onStartDateChange(nextStart);
    if (nextStart && endDate && nextStart > endDate) {
      onEndDateChange(nextStart);
    }
  };

  const handleEndChange = (value: ReturnType<typeof parseIsoDate>) => {
    const nextEnd = formatIsoDate(value);
    onEndDateChange(nextEnd);
    if (nextEnd && startDate && nextEnd < startDate) {
      onStartDateChange(nextEnd);
    }
  };

  const applyPreset = (preset: DateRangePreset) => {
    const range = getPresetDateRange(preset);
    onStartDateChange(range.startDate);
    onEndDateChange(range.endDate);
  };

  const rangeLabel = formatDateRangeLabel(startDate, endDate);
  const summary = helperText ?? rangeLabel;

  return (
    <Box
      sx={{
        border: "1px solid #e2e8f0",
        borderRadius: 2,
        p: 2,
        backgroundColor: "#f8fafc",
      }}
    >
      {showPresets && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          {PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.label}
              size="small"
              clickable
              disabled={disabled}
              onClick={() => applyPreset(preset.id)}
              sx={{
                backgroundColor: "#fff",
                border: "1px solid #cbd5e1",
                "&:hover": { backgroundColor: "#eff6ff" },
              }}
            />
          ))}
        </Stack>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
      >
        <DatePicker
          label="From"
          value={parseIsoDate(startDate)}
          onChange={handleStartChange}
          disabled={disabled}
          format="DD MMM YYYY"
          maxDate={parseIsoDate(endDate) ?? undefined}
          slots={{ openPickerIcon: CalendarMonthIcon }}
          slotProps={{
            textField: {
              size: "small",
              fullWidth: true,
              sx: { minWidth: { sm: 200 } },
            },
            openPickerButton: {
              "aria-label": "Open start date calendar",
            },
          }}
        />
        <DatePicker
          label="To"
          value={parseIsoDate(endDate)}
          onChange={handleEndChange}
          disabled={disabled}
          format="DD MMM YYYY"
          minDate={parseIsoDate(startDate) ?? undefined}
          slots={{ openPickerIcon: CalendarMonthIcon }}
          slotProps={{
            textField: {
              size: "small",
              fullWidth: true,
              sx: { minWidth: { sm: 200 } },
            },
            openPickerButton: {
              "aria-label": "Open end date calendar",
            },
          }}
        />
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        {summary}
      </Typography>
    </Box>
  );
}
