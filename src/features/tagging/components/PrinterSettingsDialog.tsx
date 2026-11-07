"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import {
  DEFAULT_PRINTER_SETTINGS,
  PRINT_SPEEDS,
  printerSettingsSchema,
  readPrinterSettings,
  writePrinterSettings,
  type PrinterSettings,
} from "@/features/tagging/lib/printerSettings";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-destructive">{message}</p>;
}

// Only mounted while the dialog is open, so it always starts from what's saved.
function PrinterSettingsForm({ onClose }: { onClose: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PrinterSettings>({
    resolver: zodResolver(printerSettingsSchema),
    defaultValues: readPrinterSettings(window.localStorage),
  });

  const onSubmit = handleSubmit((values) => {
    try {
      writePrinterSettings(window.localStorage, values);
      toast.success("Printer settings saved on this PC");
      onClose();
    } catch {
      toast.error("Couldn't save the settings in this browser.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <Label htmlFor="printerName">Printer name</Label>
        <Input id="printerName" {...register("printerName")} />
        <FieldError message={errors.printerName?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="labelSensor">Label roll type</Label>
          <Select id="labelSensor" {...register("labelSensor")}>
            <option value="black_mark">Black mark</option>
            <option value="gap">Gap</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="sensorSizeMm">Mark or gap size (mm)</Label>
          <Input
            id="sensorSizeMm"
            type="number"
            step="0.1"
            {...register("sensorSizeMm", { valueAsNumber: true })}
          />
          <FieldError message={errors.sensorSizeMm?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="shiftXMm">Shift across the label (mm)</Label>
          <Input id="shiftXMm" type="number" step="0.25" {...register("shiftXMm", { valueAsNumber: true })} />
          <FieldError message={errors.shiftXMm?.message} />
        </div>
        <div>
          <Label htmlFor="shiftYMm">Shift along the roll (mm)</Label>
          <Input id="shiftYMm" type="number" step="0.25" {...register("shiftYMm", { valueAsNumber: true })} />
          <FieldError message={errors.shiftYMm?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="darkness">Darkness (0-15)</Label>
          <Input id="darkness" type="number" step="1" {...register("darkness", { valueAsNumber: true })} />
          <FieldError message={errors.darkness?.message} />
        </div>
        <div>
          <Label htmlFor="speed">Speed (inches per second)</Label>
          <Select id="speed" {...register("speed", { valueAsNumber: true })}>
            {PRINT_SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" className="h-4 w-4 accent-primary" {...register("flipped")} />
        Turn the print upside down (if the tail comes out first)
      </label>

      <div className="mt-2 flex flex-wrap justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => reset(DEFAULT_PRINTER_SETTINGS)}>
          Reset to defaults
        </Button>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </div>
    </form>
  );
}

export function PrinterSettingsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4" />
        Printer settings
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Printer settings">
        <PrinterSettingsForm onClose={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
