import type { Tag } from "@/features/tagging/hooks/useCreateTag";
import type { PrinterSettings } from "@/features/tagging/lib/printerSettings";

// Builds the TSPL commands for one 100mm x 15mm tag on a 203 dpi printer
// (8 dots per mm). Layout mirrors TagLabelPreview.tsx: two 30mm faces that fold
// together at their shared edge, then a 40mm tail with nothing printed on it.
// This only produces text - sending it to the printer is a separate concern.
const LABEL_HEIGHT_DOTS = 120;
const FACE_WIDTH_DOTS = 240;
// Kept empty at both sides of each face, so nothing gets creased at the fold.
const MARGIN_DOTS = 12;
const USABLE_WIDTH_DOTS = FACE_WIDTH_DOTS - MARGIN_DOTS * 2;
const BACK_FACE_X = FACE_WIDTH_DOTS + MARGIN_DOTS;

// Built-in fixed-pitch font sizes, from the TSPL/TSPL2 manual's TEXT command.
const SMALL_FONT = { name: "1", width: 8, height: 12 };
const LARGE_FONT = { name: "2", width: 12, height: 20 };

// An 8-digit CODE128 code is always 79 modules, at 2 dots per module.
const BARCODE_WIDTH_DOTS = 158;
const BARCODE_HEIGHT_DOTS = 48;
const BARCODE_MODULE_DOTS = 2;
const BARCODE_Y = 36;
const CODE_TEXT_Y = 90;
const NAME_Y = 12;

const DETAIL_ROW_HEIGHT_DOTS = LARGE_FONT.height;
const DETAIL_ROW_GAP_DOTS = 7;

const DOTS_PER_MM = 8;

const TAG_CODE_PATTERN = /^\d{8}$/;
const TRUNCATION_MARK = "..";

export class TagLabelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TagLabelError";
  }
}

// TSPL marks a literal double quote as \["] and treats \[R] / \[L] as line
// breaks, so a stray backslash can't be passed through. Anything outside
// printable ASCII isn't in the built-in fonts, and this also removes raw line
// breaks, which would otherwise end the command early.
function toTsplString(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "/").replace(/"/g, '\\["]');
}

function textCommand(x: number, y: number, font: typeof LARGE_FONT, content: string): string {
  return `TEXT ${x},${y},"${font.name}",0,1,1,"${toTsplString(content)}"`;
}

function centeredX(contentWidth: number): number {
  return Math.floor((FACE_WIDTH_DOTS - contentWidth) / 2);
}

function fitName(name: string): string {
  const maxChars = Math.floor(USABLE_WIDTH_DOTS / LARGE_FONT.width);
  const printable = name.replace(/[^\x20-\x7E]/g, "").trim();
  if (printable.length <= maxChars) return printable;
  return `${printable.slice(0, maxChars - TRUNCATION_MARK.length).trimEnd()}${TRUNCATION_MARK}`;
}

function frontFace(tag: Tag): string[] {
  const name = fitName(tag.product_name);
  const codeWidth = tag.code.length * SMALL_FONT.width;
  return [
    textCommand(centeredX(name.length * LARGE_FONT.width), NAME_Y, LARGE_FONT, name),
    `BARCODE ${centeredX(BARCODE_WIDTH_DOTS)},${BARCODE_Y},"128",${BARCODE_HEIGHT_DOTS},0,0,${BARCODE_MODULE_DOTS},${BARCODE_MODULE_DOTS},"${tag.code}"`,
    textCommand(centeredX(codeWidth), CODE_TEXT_Y, SMALL_FONT, tag.code),
  ];
}

// Whole rupees, same as TagLabelPreview.tsx's formatStoneAmount. "Rs" because
// the built-in fonts have no rupee sign.
function stoneAmountText(tag: Tag): string {
  return tag.stone_amount_method === "per_gram"
    ? `Rs ${Math.round(tag.total_stone_amount)}/g`
    : `Rs ${Math.round(tag.stone_amount)} (F)`;
}

function detailRows(tag: Tag): [string, string][] {
  const rows: [string, string][] = [
    ["Gross Wt", tag.gross_wt_g.toFixed(3)],
    ["Stone Wt", tag.stone_wt_g.toFixed(3)],
    ["Net Wt", tag.net_wt_g.toFixed(3)],
  ];
  // Only shown when actually set, same as the on-screen label.
  if (tag.stone_amount > 0) rows.push(["Stone Amt", stoneAmountText(tag)]);
  return rows;
}

// Label left, value right. A row too long for the large font drops to the small
// one; a value too long for that is refused, because cutting a number short
// would print a wrong weight or price on the tag.
function detailRowCommand(label: string, value: string, y: number): string {
  const length = label.length + 1 + value.length;
  for (const font of [LARGE_FONT, SMALL_FONT]) {
    const maxChars = Math.floor(USABLE_WIDTH_DOTS / font.width);
    if (length <= maxChars) {
      const rowY = y + Math.floor((DETAIL_ROW_HEIGHT_DOTS - font.height) / 2);
      return textCommand(BACK_FACE_X, rowY, font, `${label.padEnd(maxChars - value.length)}${value}`);
    }
  }
  throw new TagLabelError(`"${label}" value is too long to fit on the label`);
}

function backFace(tag: Tag): string[] {
  const rows = detailRows(tag);
  const totalHeight = rows.length * DETAIL_ROW_HEIGHT_DOTS + (rows.length - 1) * DETAIL_ROW_GAP_DOTS;
  const startY = Math.floor((LABEL_HEIGHT_DOTS - totalHeight) / 2);
  return rows.map(([label, value], index) =>
    detailRowCommand(label, value, startY + index * (DETAIL_ROW_HEIGHT_DOTS + DETAIL_ROW_GAP_DOTS)),
  );
}

function setupCommands(settings: PrinterSettings): string[] {
  const sensor = settings.labelSensor === "gap" ? "GAP" : "BLINE";
  const shiftX = Math.round(settings.shiftXMm * DOTS_PER_MM);
  const shiftY = Math.round(settings.shiftYMm * DOTS_PER_MM);
  // All sent on every label, including the zeros, because the printer remembers
  // these between jobs and an old value would otherwise stick.
  return [
    "SIZE 100 mm,15 mm",
    `${sensor} ${settings.sensorSizeMm} mm,0 mm`,
    `SPEED ${settings.speed}`,
    `DENSITY ${settings.darkness}`,
    `DIRECTION ${settings.flipped ? 0 : 1}`,
    `SHIFT ${shiftX},${shiftY}`,
    "CLS",
  ];
}

export function buildTagLabelTspl(tag: Tag, settings: PrinterSettings): string {
  // A code in any other format wouldn't fit between the edge and the fold, so
  // refuse it here rather than print a barcode across the crease.
  if (!TAG_CODE_PATTERN.test(tag.code)) {
    throw new TagLabelError(`Tag code ${tag.code} can't be printed on this label`);
  }

  const commands = [
    ...setupCommands(settings),
    ...frontFace(tag),
    ...backFace(tag),
    "PRINT 1,1",
  ];
  return `${commands.join("\r\n")}\r\n`;
}
