import dayjs, { type Dayjs } from "dayjs";

export type DateRangePreset = "today" | "last7" | "thisMonth" | "lastMonth";

export function parseIsoDate(value: string): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed : null;
}

export function formatIsoDate(value: Dayjs | null): string {
  if (!value || !value.isValid()) return "";
  return value.format("YYYY-MM-DD");
}

export function formatDateRangeLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "Select a date range";
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (!start.isValid() || !end.isValid()) return "Select a date range";
  if (startDate === endDate) return start.format("D MMM YYYY");
  return `${start.format("D MMM YYYY")} – ${end.format("D MMM YYYY")}`;
}

export function getPresetDateRange(preset: DateRangePreset): { startDate: string; endDate: string } {
  const today = dayjs();

  switch (preset) {
    case "today":
      return {
        startDate: today.format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
    case "last7":
      return {
        startDate: today.subtract(6, "day").format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
    case "thisMonth":
      return {
        startDate: today.startOf("month").format("YYYY-MM-DD"),
        endDate: today.endOf("month").format("YYYY-MM-DD"),
      };
    case "lastMonth": {
      const lastMonth = today.subtract(1, "month");
      return {
        startDate: lastMonth.startOf("month").format("YYYY-MM-DD"),
        endDate: lastMonth.endOf("month").format("YYYY-MM-DD"),
      };
    }
  }
}

export function getThisMonthRange(): { startDate: string; endDate: string } {
  return getPresetDateRange("thisMonth");
}

export function parseDateRange(
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } | string {
  if (!startDate.trim() || !endDate.trim()) {
    return "Please select both a start date and an end date.";
  }
  if (startDate > endDate) {
    return "Start date must be on or before the end date.";
  }
  return { startDate: startDate.trim(), endDate: endDate.trim() };
}
