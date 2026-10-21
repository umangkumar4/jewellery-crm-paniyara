/**
 * `<input type="number">` has a known controlled-input quirk: React tracks
 * the last *parsed* value it rendered, and can skip writing to the DOM when
 * a new keystroke's parsed value matches that (e.g. typing "0" then "1" in
 * a field already showing "0" produces the literal text "01" in the DOM -
 * Number("01") === 1, which is what React already believes it rendered, so
 * it doesn't force the visible text back to "1"). The field gets visually
 * stuck showing a leading zero that never resolves. This happened for real
 * on the billing page's weight/rate/charge fields - confirmed via
 * screenshot, not theoretical.
 *
 * The fix used throughout this feature: don't use type="number" for these
 * fields at all. Use type="text" + inputMode="decimal", and sanitize the
 * string ourselves - strips a leading zero the moment a further digit
 * follows it, and rejects characters a number input wouldn't accept.
 */
export function sanitizeNumericInput(raw: string): string {
  // Reject anything that isn't digits with at most one decimal point -
  // same character set a number input would accept (no sign, this feature
  // never has negative weights/rates/charges).
  if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) {
    return raw; // caller should ignore this change (see useNumericField)
  }

  // "0" alone, or "0." while typing a decimal, are left untouched -
  // only strip when a non-leading-zero digit actually follows.
  if (/^0+\d/.test(raw)) {
    return raw.replace(/^0+(?=\d)/, "");
  }

  return raw;
}

export function isValidNumericInput(raw: string): boolean {
  return raw === "" || /^\d*\.?\d*$/.test(raw);
}
