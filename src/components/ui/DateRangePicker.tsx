"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange as RDPDateRange, type DayButtonProps } from "react-day-picker";
import { format, isSameDay } from "date-fns";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface DateRangeValue {
  from: Date;
  to: Date;
}

export interface DateRangePreset {
  key: string;
  label: string;
  range: () => DateRangeValue;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  presets: DateRangePreset[];
  // Which preset "Clear" resets to - falls back to the first preset if omitted.
  defaultPresetKey?: string;
  className?: string;
}

// Custom DayButton (not classNames[UI.Day]) so the colored/rounded range
// styling can read react-day-picker's `modifiers` booleans directly, instead
// of guessing which `classNames` keys the library merges onto which element.
function RangeDayButton({ day, modifiers, className, ...rest }: DayButtonProps) {
  const isEndpoint = modifiers.selected || modifiers.range_start || modifiers.range_end;
  return (
    <button
      data-day={day.date.toISOString()}
      className={cn(
        className,
        "flex h-9 items-center justify-center text-sm transition-colors",
        modifiers.range_middle ? "mx-0 w-full rounded-none" : "mx-auto my-0.5 w-9 rounded-full",
        isEndpoint && "bg-primary text-primary-foreground",
        !isEndpoint && modifiers.range_middle && "bg-primary/15 text-foreground",
        !isEndpoint && !modifiers.range_middle && !modifiers.outside && !modifiers.disabled && "text-foreground hover:bg-muted",
        modifiers.outside && !isEndpoint && "text-muted-foreground/40",
        modifiers.disabled && "pointer-events-none text-muted-foreground/30",
        modifiers.today && !isEndpoint && "font-semibold text-primary",
      )}
      {...rest}
    />
  );
}

const dayPickerClassNames = {
  months: "flex",
  month: "space-y-3",
  month_caption: "flex items-center justify-between px-1",
  caption_label: "text-sm font-semibold text-foreground",
  nav: "flex items-center gap-1",
  button_previous:
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
  button_next:
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
  chevron: "h-4 w-4 fill-current",
  month_grid: "mt-2 w-full border-collapse",
  weekday: "w-9 pb-1 text-xs font-medium text-muted-foreground",
  day: "p-0 text-center align-middle",
};

export function DateRangePicker({ value, onChange, presets, defaultPresetKey, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<RDPDateRange | undefined>(value);
  const [activePresetKey, setActivePresetKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Seed the pending draft + preset highlight from the committed `value`
  // whenever the popover transitions to open - Cancel/outside-click/Escape
  // then just close without touching `value`, since they never wrote to it.
  // Derived during render (React's recommended pattern), not in an effect -
  // an effect here would commit the stale `pending` from before the popover
  // opened for one extra frame, same reasoning as ItemTable.tsx's
  // prevWeights/prevFilters pattern elsewhere in this codebase.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPending(value);
      const match = presets.find((p) => {
        const r = p.range();
        return isSameDay(r.from, value.from) && isSameDay(r.to, value.to);
      });
      setActivePresetKey(match?.key ?? null);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function applyPreset(preset: DateRangePreset) {
    setPending(preset.range());
    setActivePresetKey(preset.key);
  }

  function handleOk() {
    if (pending?.from) {
      onChange({ from: pending.from, to: pending.to ?? pending.from });
    }
    setOpen(false);
  }

  function handleClear() {
    const fallback = presets.find((p) => p.key === defaultPresetKey) ?? presets[0];
    if (fallback) applyPreset(fallback);
  }

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium text-foreground hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {format(value.from, "d MMM")} – {format(value.to, "d MMM yyyy")}
      </button>

      {open ? (
        <div className="panel absolute right-0 z-50 mt-2 w-[min(90vw,34rem)] overflow-hidden p-0 shadow-lg">
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Select date range</p>
            <p className="font-display text-lg text-foreground">
              {pending?.from ? format(pending.from, "d MMM") : "—"} –{" "}
              {pending?.to ? format(pending.to, "d MMM yyyy") : pending?.from ? format(pending.from, "yyyy") : "—"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row">
            <div className="p-4">
              <DayPicker
                mode="range"
                numberOfMonths={1}
                selected={pending}
                onSelect={(range) => {
                  setPending(range);
                  setActivePresetKey(null);
                }}
                defaultMonth={pending?.from ?? value.from}
                classNames={dayPickerClassNames}
                components={{ DayButton: RangeDayButton }}
              />
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 border-t border-border p-4 sm:w-40 sm:border-t-0 sm:border-l">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                    activePresetKey === preset.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" size="md" onClick={handleClear}>
              Clear
            </Button>
            <Button type="button" size="md" onClick={handleOk} disabled={!pending?.from}>
              OK
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
