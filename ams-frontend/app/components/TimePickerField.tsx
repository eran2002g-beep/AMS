"use client";

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { type Dayjs } from "dayjs";

function parseTime(value: string): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, "HH:mm", true);
  return parsed.isValid() ? parsed : null;
}

function formatTime(value: Dayjs | null): string {
  if (!value || !value.isValid()) return "";
  return value.format("HH:mm");
}

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function TimePickerField({ label, value, onChange, disabled }: Props) {
  return (
    <TimePicker
      label={label}
      value={parseTime(value)}
      onChange={(newValue) => onChange(formatTime(newValue))}
      ampm={false}
      format="HH:mm"
      views={["hours", "minutes"]}
      disabled={disabled}
      slots={{ openPickerIcon: AccessTimeIcon }}
      slotProps={{
        textField: {
          fullWidth: true,
          helperText: value ? `Selected: ${value}` : "Click the clock to pick a time",
        },
        openPickerButton: {
          "aria-label": `Open clock for ${label}`,
        },
      }}
    />
  );
}
