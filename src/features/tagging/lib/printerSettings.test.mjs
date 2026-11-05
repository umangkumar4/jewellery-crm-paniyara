import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PRINTER_SETTINGS,
  printerSettingsSchema,
  readPrinterSettings,
  writePrinterSettings,
} from "./printerSettings.ts";

function memoryStorage(initial) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test("nothing saved gives the defaults", () => {
  assert.deepEqual(readPrinterSettings(memoryStorage()), DEFAULT_PRINTER_SETTINGS);
});

test("the defaults are themselves valid", () => {
  assert.equal(printerSettingsSchema.safeParse(DEFAULT_PRINTER_SETTINGS).success, true);
});

test("saved settings come back unchanged", () => {
  const storage = memoryStorage();
  const settings = { ...DEFAULT_PRINTER_SETTINGS, printerName: "Shop", flipped: true, shiftXMm: -1.5, darkness: 12, labelSensor: "gap" };
  writePrinterSettings(storage, settings);
  assert.deepEqual(readPrinterSettings(storage), settings);
});

test("a setting missing from an older save gets its default", () => {
  const storage = memoryStorage(JSON.stringify({ darkness: 12 }));
  assert.deepEqual(readPrinterSettings(storage), { ...DEFAULT_PRINTER_SETTINGS, darkness: 12 });
});

test("unreadable or invalid saves fall back to the defaults", () => {
  for (const saved of [
    "not json",
    "null",
    "[]",
    "5",
    JSON.stringify({ darkness: 99 }),
    JSON.stringify({ shiftXMm: "1\r\nPRINT 100" }),
    JSON.stringify({ sensorSizeMm: "3 mm\r\nFORMFEED" }),
    JSON.stringify({ speed: 99 }),
    JSON.stringify({ labelSensor: "other" }),
    JSON.stringify({ printerName: "" }),
  ]) {
    assert.deepEqual(readPrinterSettings(memoryStorage(saved)), DEFAULT_PRINTER_SETTINGS, saved);
  }
});

test("storage that throws still gives the defaults", () => {
  const storage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {},
  };
  assert.deepEqual(readPrinterSettings(storage), DEFAULT_PRINTER_SETTINGS);
});

test("the form rejects out-of-range values with a message", () => {
  const errorFor = (over) => {
    const result = printerSettingsSchema.safeParse({ ...DEFAULT_PRINTER_SETTINGS, ...over });
    return result.success ? null : result.error.issues[0].message;
  };
  assert.match(errorFor({ shiftXMm: 4 }), /-3 to 3/);
  assert.match(errorFor({ shiftYMm: -3.5 }), /-3 to 3/);
  assert.match(errorFor({ darkness: 16 }), /0 to 15/);
  assert.match(errorFor({ darkness: 10.5 }), /whole number/);
  assert.match(errorFor({ sensorSizeMm: 30 }), /0 to 25/);
  assert.match(errorFor({ shiftXMm: Number.NaN }), /Enter a number/);
  assert.match(errorFor({ printerName: "   " }), /required/);
  assert.equal(errorFor({ shiftXMm: 3, shiftYMm: -3, darkness: 0, sensorSizeMm: 0 }), null);
});
