import { useState } from "react";

/**
 * For a numeric field whose canonical value lives in the Zustand store
 * (discount, GST%, payment amount) rather than local component state.
 *
 * Naively doing `value={String(storeValue)}` / `onChange={(v) =>
 * setStoreValue(Number(v) || 0)}` breaks decimal entry: typing "0" then "."
 * round-trips through Number("0.") === 0 on every keystroke, so the "."
 * the user just typed gets wiped before they can type the next digit.
 *
 * This keeps a local string buffer as what's actually displayed (so "0."
 * can exist mid-typing without being clobbered), while still pushing a
 * parsed number into the store on every change so dependent calculations
 * (totals, pending amount) stay live as the user types. If the store value
 * changes from somewhere else entirely (e.g. reset() after a sale), that's
 * detected by comparing against the number we last pushed ourselves, and
 * the local buffer resyncs - same "derive during render" pattern used
 * elsewhere in this app for external-state sync (see ItemTable.tsx).
 */
export function useNumericStoreField(storeValue: number, setStoreValue: (value: number) => void) {
  const [display, setDisplay] = useState(String(storeValue));
  const [lastPushed, setLastPushed] = useState(storeValue);

  if (storeValue !== lastPushed) {
    setLastPushed(storeValue);
    setDisplay(String(storeValue));
  }

  return {
    value: display,
    onValueChange: (raw: string) => {
      setDisplay(raw);
      const parsed = Number(raw) || 0;
      setLastPushed(parsed);
      setStoreValue(parsed);
    },
  };
}
