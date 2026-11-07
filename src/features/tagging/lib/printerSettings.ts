import { z } from "zod";

// Every label roll and printer is lined up slightly differently, so these are
// saved per PC (localStorage) rather than per shop.
const STORAGE_KEY = "label-printer-settings";

const number = { error: "Enter a number" };

export const PRINT_SPEEDS = [2, 3, 4, 5] as const;

export const printerSettingsSchema = z.object({
  printerName: z.string().trim().min(1, "Printer name is required").max(100, "Printer name is too long"),
  // Turns the print 180 degrees, for a roll that feeds with the tail first.
  flipped: z.boolean(),
  shiftXMm: z.number(number).min(-3, "Use -3 to 3 mm").max(3, "Use -3 to 3 mm"),
  shiftYMm: z.number(number).min(-3, "Use -3 to 3 mm").max(3, "Use -3 to 3 mm"),
  darkness: z.number(number).int("Use a whole number").min(0, "Use 0 to 15").max(15, "Use 0 to 15"),
  speed: z.union(PRINT_SPEEDS.map((speed) => z.literal(speed))),
  labelSensor: z.enum(["black_mark", "gap"]),
  sensorSizeMm: z.number(number).min(0, "Use 0 to 25 mm").max(25, "Use 0 to 25 mm"),
});

export type PrinterSettings = z.infer<typeof printerSettingsSchema>;

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  printerName: "TSC TTP-244 Pro",
  flipped: false,
  shiftXMm: 0,
  shiftYMm: 0,
  darkness: 10,
  speed: 3,
  labelSensor: "black_mark",
  sensorSizeMm: 3,
};

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

// Anything unreadable falls back to the defaults, so a bad saved value can never
// stop a label printing or put an invalid number into a printer command.
export function readPrinterSettings(storage: SettingsStorage): PrinterSettings {
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");
    const parsed = printerSettingsSchema.safeParse({
      ...DEFAULT_PRINTER_SETTINGS,
      ...(saved as object),
    });
    return parsed.success ? parsed.data : DEFAULT_PRINTER_SETTINGS;
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function writePrinterSettings(storage: SettingsStorage, settings: PrinterSettings): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
