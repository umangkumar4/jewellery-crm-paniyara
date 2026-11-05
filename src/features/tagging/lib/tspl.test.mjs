import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { DEFAULT_PRINTER_SETTINGS } from "./printerSettings.ts";
import { buildTagLabelTspl, TagLabelError } from "./tspl.ts";

const build = (tag, settings = DEFAULT_PRINTER_SETTINGS) => buildTagLabelTspl(tag, settings);

const require = createRequire(import.meta.url);
const { CODE128 } = require("jsbarcode/bin/barcodes/CODE128/index.js");

const FONT_WIDTH = { 1: 8, 2: 12 };
const FONT_HEIGHT = { 1: 12, 2: 20 };
const FRONT = [12, 228];
const BACK = [252, 468];

const baseTag = {
  code: "00000013",
  product_name: "Gold Ring",
  gross_wt_g: 13,
  stone_wt_g: 2,
  net_wt_g: 11,
  stone_amount_method: "not_set",
  total_stone_amount: 0,
  stone_amount: 0,
};

// What the printer actually draws: a quote escape is one printed character.
const printedLength = (content) => content.replaceAll('\\["]', '"').length;

function parse(tspl) {
  const lines = tspl.split("\r\n").filter(Boolean);
  const texts = lines.flatMap((line) => {
    const match = line.match(/^TEXT (\d+),(\d+),"(\d)",0,1,1,"(.*)"$/);
    return match ? [{ x: +match[1], y: +match[2], font: match[3], content: match[4] }] : [];
  });
  const barcode = lines.find((line) => line.startsWith("BARCODE"));
  return { lines, texts, barcode };
}

function assertInBounds(tspl) {
  const { texts, barcode } = parse(tspl);
  for (const { x, y, font, content } of texts) {
    const end = x + printedLength(content) * FONT_WIDTH[font];
    const [min, max] = x < 240 ? FRONT : BACK;
    assert.ok(x >= min && end <= max, `"${content}" spans ${x}-${end}, allowed ${min}-${max}`);
    assert.ok(y >= 0 && y + FONT_HEIGHT[font] <= 120, `"${content}" overflows the label height`);
  }
  const [, x, y, height, narrow] = barcode.match(/^BARCODE (\d+),(\d+),"128",(\d+),0,0,(\d+),\d+,"/);
  assert.ok(+x >= FRONT[0] && +x + 79 * +narrow <= FRONT[1], "barcode crosses the fold margin");
  assert.ok(+y + +height <= 120, "barcode overflows the label height");
}

test("the 8-digit barcode is really 79 modules", () => {
  for (const code of ["00000013", "99999992"]) {
    assert.equal(new CODE128(code, {}).encode().data.length, 79);
  }
});

test("builds the expected commands for a simple tag", () => {
  assert.equal(
    build(baseTag),
    [
      "SIZE 100 mm,15 mm",
      "BLINE 3 mm,0 mm",
      "SPEED 3",
      "DENSITY 10",
      "DIRECTION 1",
      "SHIFT 0,0",
      "CLS",
      'TEXT 66,12,"2",0,1,1,"Gold Ring"',
      'BARCODE 41,36,"128",48,0,0,2,2,"00000013"',
      'TEXT 88,90,"1",0,1,1,"00000013"',
      'TEXT 252,23,"2",0,1,1,"Gross Wt    13.000"',
      'TEXT 252,50,"2",0,1,1,"Stone Wt     2.000"',
      'TEXT 252,77,"2",0,1,1,"Net Wt      11.000"',
      "PRINT 1,1",
      "",
    ].join("\r\n"),
  );
});

test("hides the stone amount row when it is 0", () => {
  assert.doesNotMatch(build(baseTag), /Stone Amt/);
});

test("shows a per-gram stone amount as the entered rate", () => {
  const tspl = build({
    ...baseTag,
    stone_amount_method: "per_gram",
    total_stone_amount: 13,
    stone_amount: 26,
  });
  assert.match(tspl, /"Stone Amt  Rs 13\/g"/);
  assert.doesNotMatch(tspl, /Rs 26/);
});

test("shows a fixed stone amount with its (F) marker", () => {
  const tspl = build({ ...baseTag, stone_amount_method: "fixed", total_stone_amount: 500, stone_amount: 500 });
  assert.match(tspl, /"Stone Amt\s+Rs 500 \(F\)"/);
});

test("a large fixed amount switches to the small font and stays in bounds", () => {
  const tspl = build({ ...baseTag, stone_amount_method: "fixed", total_stone_amount: 12500, stone_amount: 12500 });
  const row = parse(tspl).texts.find((text) => text.content.startsWith("Stone Amt"));
  assert.equal(row.font, "1");
  assert.match(row.content, /Rs 12500 \(F\)$/);
  assertInBounds(tspl);
});

test("refuses a value too long to fit, rather than cutting it short", () => {
  assert.throws(
    () => build({ ...baseTag, stone_amount_method: "fixed", stone_amount: 1e20 }),
    TagLabelError,
  );
});

test("shortens long names and marks them", () => {
  const tspl = build({ ...baseTag, product_name: "A".repeat(120) });
  const name = parse(tspl).texts[0].content;
  assert.equal(name, `${"A".repeat(16)}..`);
  assertInBounds(tspl);
});

test("an 18-character name prints in full", () => {
  const name = "B".repeat(18);
  assert.equal(parse(build({ ...baseTag, product_name: name })).texts[0].content, name);
});

test("a double quote can't break out of the command", () => {
  const tspl = build({ ...baseTag, product_name: 'Chain 22" long' });
  assert.ok(tspl.includes('"Chain 22\\["] long"'));
});

test("a quote at the shortening point is not split", () => {
  const tspl = build({ ...baseTag, product_name: `${"C".repeat(15)}"${"D".repeat(20)}` });
  assert.equal(parse(tspl).texts[0].content, `${"C".repeat(15)}\\["]..`);
  assertInBounds(tspl);
});

test("command-like names stay plain text", () => {
  const attempts = [
    'x"\r\nPRINT 100,1\r\n"',
    'x"\nFORMFEED\n"',
    "Ring \\[R]PRINT 100",
    "Ring \\[L]",
  ];
  for (const product_name of attempts) {
    const { lines, texts } = parse(build({ ...baseTag, product_name }));
    assert.equal(lines.filter((line) => line.startsWith("PRINT")).length, 1, product_name);
    assert.equal(lines.filter((line) => line.startsWith("FORMFEED")).length, 0, product_name);
    assert.equal(lines.length, 14, product_name);
    assert.doesNotMatch(texts[0].content, /\\\[[RL]\]/, product_name);
  }
});

test("removes characters the built-in fonts don't have", () => {
  assert.equal(parse(build({ ...baseTag, product_name: "Ring ₹ अं" })).texts[0].content, "Ring");
});

test("refuses codes that would cross the fold", () => {
  for (const code of ["TAG-NVUXY8A0", "0000001", "000000013", 'a"b00000']) {
    assert.throws(() => build({ ...baseTag, code }), TagLabelError, code);
  }
});

test("everything stays inside the two faces across a range of tags", () => {
  const names = ["A", "Gold Ring - floral", "W".repeat(120), `${'"'.repeat(30)}`, 'Mix "of" symbols & long text here'];
  const weights = [0.001, 5, 13.5, 999.999, 12345.678, 1234567.891];
  const stones = [
    { stone_amount_method: "not_set", total_stone_amount: 0, stone_amount: 0 },
    { stone_amount_method: "fixed", total_stone_amount: 500, stone_amount: 500 },
    { stone_amount_method: "fixed", total_stone_amount: 999999, stone_amount: 999999 },
    { stone_amount_method: "per_gram", total_stone_amount: 13, stone_amount: 26 },
    { stone_amount_method: "per_gram", total_stone_amount: 99999, stone_amount: 199998 },
  ];
  for (const product_name of names) {
    for (const weight of weights) {
      for (const stone of stones) {
        assertInBounds(
          build({ ...baseTag, ...stone, product_name, gross_wt_g: weight, stone_wt_g: weight, net_wt_g: weight }),
        );
      }
    }
  }
});

test("printer settings set the setup commands", () => {
  const tspl = build(baseTag, {
    ...DEFAULT_PRINTER_SETTINGS,
    flipped: true,
    shiftXMm: -1.5,
    shiftYMm: 2.25,
    darkness: 12,
    speed: 2,
    labelSensor: "gap",
    sensorSizeMm: 2.5,
  });
  const setup = tspl.split("\r\n").slice(0, 7);
  assert.deepEqual(setup, [
    "SIZE 100 mm,15 mm",
    "GAP 2.5 mm,0 mm",
    "SPEED 2",
    "DENSITY 12",
    "DIRECTION 0",
    "SHIFT -12,18",
    "CLS",
  ]);
});

test("settings don't move anything in the layout itself", () => {
  const body = (settings) => build(baseTag, settings).split("CLS")[1];
  const changed = { ...DEFAULT_PRINTER_SETTINGS, flipped: true, shiftXMm: 3, shiftYMm: -3, darkness: 15, labelSensor: "gap" };
  assert.equal(body(changed), body(DEFAULT_PRINTER_SETTINGS));
});

test("position shifts become whole dots", () => {
  for (const shiftXMm of [0.1, 0.33, 1.01, -2.77]) {
    assert.match(build(baseTag, { ...DEFAULT_PRINTER_SETTINGS, shiftXMm }), /^SHIFT -?\d+,0\r$/m);
  }
});

test("nothing is ever printed on the tail", () => {
  const { texts } = parse(
    build({ ...baseTag, stone_amount_method: "fixed", stone_amount: 999999, product_name: "W".repeat(120) }),
  );
  for (const { x, font, content } of texts) {
    assert.ok(x + printedLength(content) * FONT_WIDTH[font] <= 480);
  }
});
