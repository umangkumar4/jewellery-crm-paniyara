"use client";

import { useState } from "react";
import { format, startOfMonth, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";

export interface DateRange {
  from: string;
  to: string;
}

type PresetKey = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

export const DEFAULT_PRESET: PresetKey = "7d";

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function rangeForPreset(key: PresetKey): DateRange | null {
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
    case "custom":
      return null;
  }
}

export interface DateRangeFilterProps {
  onChange: (range: DateRange) => void;
}

// Uncontrolled: owns which preset/custom dates are selected, only reports
// the resolved {from, to} upward. The page doesn't need the raw preset
// state, just the range to feed into the KPI row and the chart.
export function DateRangeFilter({ onChange }: DateRangeFilterProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>(DEFAULT_PRESET);
  const defaultRange = rangeForPreset(DEFAULT_PRESET)!;
  const [customFrom, setCustomFrom] = useState(defaultRange.from);
  const [customTo, setCustomTo] = useState(defaultRange.to);

  function selectPreset(key: PresetKey) {
    setActivePreset(key);
    if (key === "custom") return; // wait for explicit from/to input below
    const range = rangeForPreset(key);
    if (range) onChange(range);
  }

  function applyCustom(from: string, to: string) {
    setCustomFrom(from);
    setCustomTo(to);
    if (from && to && to >= from) {
      onChange({ from, to });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => selectPreset(preset.key)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            activePreset === preset.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {preset.label}
        </button>
      ))}
      {activePreset === "custom" ? (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => applyCustom(e.target.value, customTo)}
            className="w-auto"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            min={customFrom}
            onChange={(e) => applyCustom(customFrom, e.target.value)}
            className="w-auto"
          />
        </div>
      ) : null}
    </div>
  );
}
