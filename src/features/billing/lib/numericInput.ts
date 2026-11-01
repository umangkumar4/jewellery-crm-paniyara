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

// For weight fields specifically (gross/stone/net/dust/other-deduction, in
// grams) - same character set as isValidNumericInput, but caps digits after
// the decimal point at 3. Jewellery scales don't resolve finer than 1mg, so
// a 4th decimal is never a real measurement, just keystroke noise - this
// rejects it the instant it's typed (same mechanism already used to reject
// a stray letter or a second decimal point), rather than letting it through
// and only losing it later when net weight gets rounded. sanitizeNumericInput
// (the leading-zero fix) is reused as-is for weight fields - that part of
// the logic doesn't depend on decimal count.
export function isValidWeightInput(raw: string): boolean {
  return raw === "" || /^\d*\.?\d{0,3}$/.test(raw);
}

// For money fields that may carry paise (Discount, Stone Charge, Making
// Charge value) - same character set as isValidNumericInput, but caps
// digits after the decimal point at 2, matching how rupees are actually
// denominated. Same reasoning as isValidWeightInput's 3dp cap for gram
// weights: reject a 3rd decimal the instant it's typed, rather than
// accepting it and only losing/mismatching it later during calculation
// (this was the exact root cause of Discount accepting ₹100.555 while the
// display rounded it to ₹100.56 - the two disagreed because nothing
// stopped the 3rd decimal from being entered in the first place).
export function isValidMoneyInput(raw: string): boolean {
  return raw === "" || /^\d*\.?\d{0,2}$/.test(raw);
}

// For money fields that must stay in whole rupees (Payment Amount) -
// rejects a decimal point entirely. grandTotal and old-jewellery value are
// both whole rupees by convention, so restricting payments to whole
// rupees too guarantees the pending balance can never carry paise, with
// no extra rounding logic needed anywhere downstream.
export function isValidWholeRupeeInput(raw: string): boolean {
  return raw === "" || /^\d*$/.test(raw);
}
