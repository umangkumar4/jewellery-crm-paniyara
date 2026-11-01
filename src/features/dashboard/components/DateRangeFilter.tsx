"use client";

import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, subDays } from "date-fns";
import { DateRangePicker, type DateRangePreset, type DateRangeValue } from "@/components/ui/DateRangePicker";

export interface DateRange {
  from: string;
  to: string;
}

type PresetKey = "today" | "yesterday" | "7d" | "30d" | "month";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "month", label: "This Month" },
];

export const DEFAULT_PRESET: PresetKey = "7d";

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function fromDateKey(key: string): Date {
  return parseISO(key);
}

// Shared preset list (Today/Yesterday/7d/30d/Month) in the {key, label,
// range} shape DateRangePicker's `presets` prop expects - other callers
// (invoice list filters) reuse this instead of re-deriving it.
export function buildDateRangePresets(): DateRangePreset[] {
  return PRESETS.map((preset) => ({
    key: preset.key,
    label: preset.label,
    range: (): DateRangeValue => {
      const r = rangeForPreset(preset.key);
      return { from: fromDateKey(r.from), to: fromDateKey(r.to) };
    },
  }));
}

export function rangeForPreset(key: PresetKey): DateRange {
  const today = new Date();
  switch (key) {
    case "today":
      return { from: toDateKey(today), to: toDateKey(today) };
    case "yesterday": {
      const yesterday = subDays(today, 1);
      return { from: toDateKey(yesterday), to: toDateKey(yesterday) };
    }
    case "7d":
      return { from: toDateKey(subDays(today, 6)), to: toDateKey(today) };
    case "30d":
      return { from: toDateKey(subDays(today, 29)), to: toDateKey(today) };
    case "month":
      return { from: toDateKey(startOfMonth(today)), to: toDateKey(today) };
  }
}

export interface DateRangeFilterProps {
  onChange: (range: DateRange) => void;
  // Which preset this filter opens with (and what its own "Clear" falls
  // back to) - defaults to DEFAULT_PRESET so every existing caller keeps
  // its current behavior unless it opts into a different one.
  defaultPresetKey?: PresetKey;
}

// Uncontrolled: owns which range is currently selected, only reports the
// resolved {from, to} upward. The page doesn't need to know which preset (if
// any) produced it, just the range to feed into the KPI row and the chart.
export function DateRangeFilter({ onChange, defaultPresetKey = DEFAULT_PRESET }: DateRangeFilterProps) {
  const defaultRange = rangeForPreset(defaultPresetKey);
  const [range, setRange] = useState<DateRange>(defaultRange);

  const presets = useMemo(() => buildDateRangePresets(), []);

  function handleChange(next: DateRangeValue) {
    const nextRange: DateRange = { from: toDateKey(next.from), to: toDateKey(next.to) };
    setRange(nextRange);
    onChange(nextRange);
  }

  return (
    <DateRangePicker
      value={{ from: fromDateKey(range.from), to: fromDateKey(range.to) }}
      onChange={handleChange}
      presets={presets}
      defaultPresetKey={defaultPresetKey}
    />
  );
}
