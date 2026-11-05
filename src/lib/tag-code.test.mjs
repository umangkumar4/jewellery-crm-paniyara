import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTagCode, MAX_TAG_SEQUENCE } from "./tag-code.ts";

// A code is only ever issued if its last digit is the check digit of its
// first seven. A mistyped code is "caught" when that doesn't hold, because
// such a code can never exist in the database.
function isIssuable(code) {
  const sequence = Number(code.slice(0, 7));
  return sequence >= 1 && formatTagCode(sequence) === code;
}

function sampleSequences() {
  const sequences = [1, 2, 3, 9, 10, 99, 100, 1234567, MAX_TAG_SEQUENCE - 1, MAX_TAG_SEQUENCE];
  for (let sequence = 1; sequence <= MAX_TAG_SEQUENCE; sequence += 997) sequences.push(sequence);
  return sequences;
}

test("matches the published Damm example", () => {
  // Damm's standard worked example: the check digit of 572 is 4.
  assert.equal(formatTagCode(572), "00005724");
});

test("always produces exactly 8 digits", () => {
  for (const sequence of sampleSequences()) {
    assert.match(formatTagCode(sequence), /^\d{8}$/);
  }
});

test("keeps leading zeros", () => {
  assert.ok(formatTagCode(1).startsWith("0000001"));
});

test("gives different codes to different sequence numbers", () => {
  const sequences = sampleSequences();
  assert.equal(new Set(sequences.map(formatTagCode)).size, new Set(sequences).size);
});

test("catches every single-digit typo", () => {
  for (const sequence of sampleSequences()) {
    const code = formatTagCode(sequence);
    for (let position = 0; position < code.length; position++) {
      for (let digit = 0; digit <= 9; digit++) {
        if (code[position] === String(digit)) continue;
        const typo = code.slice(0, position) + digit + code.slice(position + 1);
        assert.equal(isIssuable(typo), false, `${code} -> ${typo}`);
      }
    }
  }
});

test("catches every swap of two neighbouring digits", () => {
  for (const sequence of sampleSequences()) {
    const code = formatTagCode(sequence);
    for (let position = 0; position < code.length - 1; position++) {
      if (code[position] === code[position + 1]) continue;
      const swapped =
        code.slice(0, position) + code[position + 1] + code[position] + code.slice(position + 2);
      assert.equal(isIssuable(swapped), false, `${code} -> ${swapped}`);
    }
  }
});

test("rejects numbers outside the 7-digit range", () => {
  for (const sequence of [0, -1, 1.5, Number.NaN, MAX_TAG_SEQUENCE + 1]) {
    assert.throws(() => formatTagCode(sequence), RangeError);
  }
});
