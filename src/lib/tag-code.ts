// Tag codes are a 7-digit running number plus 1 Damm check digit. Eight
// digits keeps the CODE128 barcode to 79 modules (19.75mm at 2-dot bars),
// which fits the label's 27mm barcode space. The check digit is there for
// hand-typed codes: without it, one mistyped digit in a sequential code would
// usually be another real tag, and billing would load the wrong item.
export const MAX_TAG_SEQUENCE = 9_999_999;

const TAG_SEQUENCE_DIGITS = 7;

const DAMM_TABLE = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
  [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
  [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
  [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
  [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
  [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

function dammCheckDigit(digits: string): number {
  let interim = 0;
  for (const digit of digits) {
    interim = DAMM_TABLE[interim][Number(digit)];
  }
  return interim;
}

export function formatTagCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_TAG_SEQUENCE) {
    throw new RangeError(`Tag sequence out of range: ${sequence}`);
  }
  const digits = String(sequence).padStart(TAG_SEQUENCE_DIGITS, "0");
  return `${digits}${dammCheckDigit(digits)}`;
}
