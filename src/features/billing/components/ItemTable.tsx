"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, RowClassParams } from "ag-grid-community";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SelectField } from "@/components/ui/SelectField";
import { toOptions } from "@/components/ui/react-select-styles";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { cn } from "@/lib/utils";
import { METALS, type Metal } from "@/lib/metals";
import { useMetalPurities } from "@/features/settings/hooks/useMetalPurities";
import { NumberField } from "@/features/billing/components/NumberField";
import { WeightField } from "@/components/ui/WeightField";
import { ScanInput } from "@/features/billing/components/ScanInput";
import { MakingChargeDialog } from "@/features/billing/components/MakingChargeDialog";
import { sanitizeNumericInput, isValidNumericInput, isValidWeightInput } from "@/features/billing/lib/numericInput";
import { useNumericStoreField } from "@/features/billing/lib/useNumericStoreField";
import { calculateItemTotal, calculateMakingCharge, type MakingMethod } from "@/features/billing/lib/calculations";
import { useBillingStore, type BillingItem } from "@/store/useBillingStore";

// Same 2dp convention every other money display in this app uses
// (TotalsPanel, PrintInvoice, invoice detail page) - Making Charge and
// line Total can both carry paise now that calculateItemTotal/
// calculateMakingCharge no longer round to a whole rupee per line.
function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Mirrors createInvoiceSchema's mandatory checks for description/gross
// weight/net weight/rate per gram - computed live, straight from the item,
// so a row shows red the instant a mandatory field is 0/empty rather than
// only after an explicit "Finalize Sale" attempt runs the full Zod parse.
function getLiveItemErrors(item: BillingItem): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!item.description.trim()) errors.description = "Description is required";
  if (!(item.grossWtG > 0)) errors.gross_wt_g = "Gross weight is required";
  if (!(item.netWtG > 0)) errors.net_wt_g = "Net weight is required";
  if (!(item.ratePerGram > 0)) errors.rate_per_gram = "Rate per gram is required";
  // Pieces multiplies directly into the line total (calculations.ts) -
  // unset/fractional pieces is a pricing error, gated the same as the
  // other mandatory fields above.
  if (!(item.pieces > 0) || !Number.isInteger(item.pieces)) {
    errors.pieces = "Pieces must be a whole number, at least 1";
  }
  // Mirrors createInvoiceSchema's total: z.number().positive(...) - a line
  // that contributes ₹0 to the bill is always incomplete or a mistake
  // (unset rate, or a net weight so small the metal value rounds to ₹0),
  // never an intentional free item - this app has no concept of one.
  if (!(item.total > 0)) errors.total = "Total must be greater than 0";
  return errors;
}

type EditableField =
  | "description"
  | "hsnCode"
  | "metal"
  | "purity"
  | "pieces"
  | "grossWtG"
  | "stoneWtG"
  | "netWtG"
  | "ratePerGram"
  | "stoneCharge"
  | "buyerCode";

const METAL_OPTIONS = toOptions(METALS);

const MAKING_METHOD_BADGE: Record<MakingMethod, string | null> = {
  fixed: null,
  per_gram: "₹/g",
  percent_metal: "% metal",
};

const NUMERIC_FIELDS = new Set<EditableField>([
  "pieces",
  "grossWtG",
  "stoneWtG",
  "netWtG",
  "ratePerGram",
  "stoneCharge",
]);

// Subset of NUMERIC_FIELDS that are gram weights, not money/count - these
// get the 3-decimal cap (isValidWeightInput) in ItemFieldCell below instead
// of the unrestricted isValidNumericInput, same rule WeightField applies to
// the standalone forms (ManualAddForm, TagForm, AddOldJewelleryItemDialog).
const WEIGHT_FIELDS = new Set<EditableField>(["grossWtG", "stoneWtG", "netWtG"]);

// Maps this component's camelCase field names to the Zod schema's
// snake_case field names, so a validation issue's path (e.g. "rate_per_gram")
// can be matched back to the right inline-editable cell.
const SCHEMA_FIELD_NAMES: Record<EditableField, string> = {
  description: "description",
  hsnCode: "hsn_code",
  metal: "metal",
  purity: "purity",
  pieces: "pieces",
  grossWtG: "gross_wt_g",
  stoneWtG: "stone_wt_g",
  netWtG: "net_wt_g",
  ratePerGram: "rate_per_gram",
  stoneCharge: "stone_charge",
  buyerCode: "buyer_code",
};

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  hsn_code: "HSN code",
  metal: "Metal",
  purity: "Purity",
  pieces: "Pieces",
  gross_wt_g: "Gross weight",
  stone_wt_g: "Stone weight",
  net_wt_g: "Net weight",
  rate_per_gram: "Rate per gram",
  making_charge: "Making charge",
  stone_charge: "Stone charge",
  tag_code: "Tag code",
  buyer_code: "Buyer Code",
  total: "Total",
  _item: "This item",
};

interface EditCellExtra {
  field: EditableField;
  onFieldChange: (rowIndex: number, field: EditableField, raw: string) => void;
}

// Each cell subscribes directly to the slice of the store it needs
// (its row's submitted-validation error) rather than having that threaded
// through cellRendererParams/columnDefs - columnDefs stays a stable
// reference across every keystroke this way (only rowData changes, which
// ag-grid refreshes without remounting cell components), so a controlled
// <input> here never loses focus mid-type the way it would if columnDefs
// regenerated on every store update.
function ItemFieldCell({ data, node, field, onFieldChange }: ICellRendererParams<BillingItem> & EditCellExtra) {
  const rowIndex = node.rowIndex;
  const schemaField = SCHEMA_FIELD_NAMES[field];
  const submittedError = useBillingStore((s) => (rowIndex != null ? s.itemErrors[rowIndex]?.[schemaField] : undefined));

  const numeric = NUMERIC_FIELDS.has(field);
  const value = data ? data[field] : "";

  // Called unconditionally (Rules of Hooks) - for text cells it's inert,
  // fed a constant 0 and its output never used.
  const numericField = useNumericStoreField(typeof value === "number" ? value : 0, (n) => {
    if (rowIndex != null) onFieldChange(rowIndex, field, String(n));
  });

  if (!data || rowIndex == null) return null;

  const liveErrors = getLiveItemErrors(data);
  const hasError = !!(liveErrors[schemaField] || submittedError);

  return (
    <input
      // type="text" + inputMode="decimal", not type="number" - see
      // numericInput.ts for why: a real, screenshot-confirmed bug where
      // React can leave a literal "011" stuck on screen for a number input
      // even though the underlying value is correctly 11.
      type="text"
      inputMode={numeric ? "decimal" : undefined}
      value={numeric ? numericField.value : (value as string)}
      onChange={(e) => {
        const raw = e.target.value;
        if (!numeric) {
          onFieldChange(rowIndex, field, raw);
          return;
        }
        const isValid = WEIGHT_FIELDS.has(field) ? isValidWeightInput(raw) : isValidNumericInput(raw);
        if (!isValid) return;
        numericField.onValueChange(sanitizeNumericInput(raw));
      }}
      onBlur={() => {
        if (!numeric) return;
        // Normalize the buffer to canonical form: "" -> "0" (previous
        // behavior, preserved), "15." -> "15", "15.50" -> "15.5".
        const canonical = String(Number(numericField.value) || 0);
        if (canonical !== numericField.value) {
          numericField.onValueChange(canonical);
        }
      }}
      className={cn(
        "w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-foreground hover:border-border focus-visible:border-input focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        hasError && "border-destructive focus-visible:ring-destructive",
      )}
    />
  );
}

// Locked, not an ItemFieldCell - net weight is always derived from gross -
// stone (handleFieldChange below recomputes patch.netWtG whenever either
// changes), never typed directly in the grid either. Keeps net structurally
// consistent with gross/stone instead of letting someone type an
// inconsistent, even physically impossible, value (net > gross) straight
// onto a real invoice line - mirrors ManualAddForm's read-only net field.
function NetWeightCell({ data }: ICellRendererParams<BillingItem>) {
  if (!data) return null;
  const hasError = !(data.netWtG > 0);
  return (
    <input
      type="text"
      readOnly
      tabIndex={-1}
      value={data.netWtG.toFixed(3)}
      className={cn(
        "w-full min-w-0 cursor-default rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-foreground",
        hasError && "text-destructive",
      )}
    />
  );
}

// A tag represents exactly one unique physical item - letting pieces be
// edited away from 1 on a tag-linked row would bill the customer for N
// units while the backend still only marks the one matching tag `sold`
// (createInvoice matches purely by tag code, with no awareness of a line's
// `pieces` value). Locked read-only here for tag-linked rows; manual rows
// (no tag) are unaffected and stay fully editable via ItemFieldCell.
function PiecesCell(props: ICellRendererParams<BillingItem> & EditCellExtra) {
  if (props.data?.tagCode) {
    return <span className="block px-2 py-1 text-sm text-muted-foreground">1</span>;
  }
  return <ItemFieldCell {...props} />;
}

interface MakingChargeCellExtra {
  onOpen: (rowIndex: number) => void;
}

// Locked, not an ItemFieldCell - making charge is never typed directly
// anymore, only set via MakingChargeDialog (opened by clicking this cell).
// Shows the computed ₹ figure plus a small badge naming the method behind
// it, so "₹12,500" next to "₹/g" reads as "this is a formula result", not
// an arbitrary flat number.
function MakingChargeCell({ data, node, onOpen }: ICellRendererParams<BillingItem> & MakingChargeCellExtra) {
  const rowIndex = node.rowIndex;
  if (!data || rowIndex == null) return null;
  const badge = MAKING_METHOD_BADGE[data.makingMethod];

  return (
    <button
      type="button"
      onClick={() => onOpen(rowIndex)}
      className="flex h-full w-full items-center justify-between gap-1.5 px-2 text-sm text-foreground hover:bg-muted/50"
    >
      <span>{formatInr(data.makingCharge)}</span>
      {badge ? (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function RemoveCell({ node }: ICellRendererParams<BillingItem>) {
  const removeItem = useBillingStore((s) => s.removeItem);
  const rowIndex = node.rowIndex;
  if (rowIndex == null) return null;
  return (
    <div className="flex h-full items-center">
      <button
        type="button"
        onClick={() => removeItem(rowIndex)}
        aria-label="Remove item"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ManualAddForm({ onDone }: { onDone: () => void }) {
  const addItem = useBillingStore((state) => state.addItem);
  const [metal, setMetal] = useState<Metal>(METALS[0]);
  const [description, setDescription] = useState("");
  const [hsnCode, setHsnCode] = useState("7113");
  const [purity, setPurity] = useState("");
  const [pieces, setPieces] = useState("1");
  const [grossWtG, setGrossWtG] = useState("0");
  const [stoneWtG, setStoneWtG] = useState("0");
  const [netWtG, setNetWtG] = useState("0");
  const [ratePerGram, setRatePerGram] = useState("0");
  const [makingMethod, setMakingMethod] = useState<MakingMethod>("fixed");
  const [makingValue, setMakingValue] = useState(0);
  const [makingCharge, setMakingCharge] = useState(0);
  const [showMakingDialog, setShowMakingDialog] = useState(false);
  const [stoneCharge, setStoneCharge] = useState("0");
  const [buyerCode, setBuyerCode] = useState("");

  const { data: purities } = useMetalPurities({ metal });
  const hasPurities = !!purities && purities.length > 0;
  const purityOptions = useMemo(
    () => (purities ?? []).map((p) => ({ label: p.purity, value: p.purity })),
    [purities],
  );

  // No auto-select here, deliberately - purity (and the rate it carries)
  // stays whatever the cashier explicitly picks from the dropdown below, so
  // they always know whether they chose one or left it blank, rather than
  // the form silently pre-filling the first purity in the list the moment a
  // metal is picked or this dialog opens.

  // Net weight auto-computed from gross - stone, same math as TagForm.tsx's
  // tagging form (Math.max(0, gross - stone)) - still fully editable
  // afterward, but recalculated again any time gross/stone change. Rounded
  // to 3dp, not 2 - gross/stone weights are routinely entered to 3 decimal
  // places (milligram precision), and rounding to 2dp could both lose a
  // real digit and round the wrong way (22.972 - 2.067 = 20.905, which
  // rounded to 2dp incorrectly became 20.91, not just a shorter 20.9).
  // Derived during render (not a useEffect) for the same reason as the
  // purities block above.
  const [prevWeights, setPrevWeights] = useState({ grossWtG, stoneWtG });
  if (prevWeights.grossWtG !== grossWtG || prevWeights.stoneWtG !== stoneWtG) {
    setPrevWeights({ grossWtG, stoneWtG });
    const net = Math.max(0, (Number(grossWtG) || 0) - (Number(stoneWtG) || 0));
    setNetWtG(String(Math.round(net * 1000) / 1000));
  }

  // Making charge is locked, set only via MakingChargeDialog - but for
  // "per_gram"/"percent_metal" it's a live formula over net weight and
  // rate/g, so if either changes after a method's been applied (including
  // via the gross/stone-driven net-weight derive just above), recompute it
  // here too, same as ItemTable's grid does for an already-added row.
  // "fixed" has no formula, so nothing to recompute.
  const [prevForMaking, setPrevForMaking] = useState({ netWtG, ratePerGram });
  if (
    makingMethod !== "fixed" &&
    (prevForMaking.netWtG !== netWtG || prevForMaking.ratePerGram !== ratePerGram)
  ) {
    setPrevForMaking({ netWtG, ratePerGram });
    setMakingCharge(
      calculateMakingCharge({
        method: makingMethod,
        value: makingValue,
        netWtG: Number(netWtG) || 0,
        ratePerGram: Number(ratePerGram) || 0,
      }),
    );
  }

  // Description, gross/net weight, and rate per gram are mandatory - a
  // physical item being billed can't have a nameless, weightless, or
  // unpriced line. Stone weight is deliberately NOT required here: a plain
  // gold band genuinely has zero stone weight, that's a valid real value,
  // not a missing one (see docs/billing-plan.md). Pieces is mandatory too -
  // it multiplies directly into the line total (calculations.ts), so a
  // zero/fractional value is a pricing error, not just an unset count.
  const hasDescription = description.trim().length > 0;
  const hasGrossWt = Number(grossWtG) > 0;
  const hasNetWt = Number(netWtG) > 0;
  const hasRate = Number(ratePerGram) > 0;
  const hasPieces = Number(pieces) > 0 && Number.isInteger(Number(pieces));
  // Mirrors createInvoiceSchema's total: z.number().positive(...) - computed
  // the same way withTotal() in useBillingStore.ts computes the real stored
  // total, so this preview can never drift from what addItem() below would
  // actually produce.
  const previewTotal = calculateItemTotal({
    netWtG: Number(netWtG) || 0,
    ratePerGram: Number(ratePerGram) || 0,
    makingCharge,
    stoneCharge: Number(stoneCharge) || 0,
    pieces: Number(pieces) || 0,
  });
  const hasTotal = previewTotal > 0;
  const canAdd = hasDescription && hasGrossWt && hasNetWt && hasRate && hasPieces && hasTotal;

  const handleAdd = () => {
    if (!canAdd) return;
    addItem({
      tagCode: null,
      description: description.trim(),
      hsnCode: hsnCode.trim(),
      metal,
      purity,
      pieces: Number(pieces) || 0,
      grossWtG: Number(grossWtG) || 0,
      stoneWtG: Number(stoneWtG) || 0,
      netWtG: Number(netWtG) || 0,
      ratePerGram: Number(ratePerGram) || 0,
      makingCharge,
      makingMethod,
      makingValue,
      stoneCharge: Number(stoneCharge) || 0,
      buyerCode: buyerCode.trim(),
    });
    onDone();
  };

  return (
    // Wider than Dialog's default max-w-lg - this form's 4-column grid of
    // labeled numeric fields needs more room than a typical modal's content.
    <Dialog open onClose={onDone} title="Add Item" className="max-w-2xl">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-2">
          <Label htmlFor="manual-description">Description *</Label>
          <Input id="manual-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          {!hasDescription ? <p className="mt-1.5 text-xs text-destructive">Description is required</p> : null}
        </div>
        <div>
          <Label htmlFor="manual-hsn">HSN Code</Label>
          <Input id="manual-hsn" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="manual-pieces">Pieces *</Label>
          <NumberField id="manual-pieces" value={pieces} onValueChange={setPieces} />
          {!hasPieces ? <p className="mt-1.5 text-xs text-destructive">Pieces must be a whole number, at least 1</p> : null}
        </div>
        <div>
          <Label htmlFor="manual-buyer-code">Buyer Code</Label>
          <Input
            id="manual-buyer-code"
            value={buyerCode}
            onChange={(e) => setBuyerCode(e.target.value)}
            maxLength={30}
            placeholder="Optional"
          />
        </div>

        <div>
          <Label htmlFor="manual-metal">Metal</Label>
          <SelectField
            inputId="manual-metal"
            options={METAL_OPTIONS}
            value={METAL_OPTIONS.find((o) => o.value === metal) ?? null}
            onChange={(option) => {
              setMetal((option?.value ?? METALS[0]) as Metal);
              setPurity("");
              // Rate was previously re-filled automatically the instant the
              // purities list reloaded for the new metal. Now that purity
              // isn't auto-selected, a rate left over from the old metal
              // would otherwise silently persist - reset it too, so a
              // forgotten purity pick shows up as "Rate per gram is
              // required" instead of a plausible-looking wrong number.
              setRatePerGram("0");
            }}
          />
        </div>
        <div>
          <Label htmlFor="manual-purity">Purity</Label>
          <SelectField
            inputId="manual-purity"
            isDisabled={!hasPurities}
            // No fake empty option needed - react-select shows the
            // placeholder below whenever `value` is null, without the
            // native-<select> auto-select-first-option quirk that the old
            // "Select purity" option existed to work around. isClearable
            // lets the cashier explicitly go back to "no purity picked"
            // the same way re-selecting that old option did.
            isClearable={hasPurities}
            placeholder={hasPurities ? "Select purity" : "No purities yet"}
            options={purityOptions}
            value={hasPurities ? purityOptions.find((o) => o.value === purity) ?? null : null}
            onChange={(option) => {
              setPurity(option?.value ?? "");
              const match = purities?.find((p) => p.purity === option?.value);
              setRatePerGram(String(match?.rate_per_gram ?? 0));
            }}
          />
        </div>
        <div>
          <Label htmlFor="manual-rate">Rate/g (₹) *</Label>
          <NumberField id="manual-rate" value={ratePerGram} onValueChange={setRatePerGram} />
          {!hasRate ? <p className="mt-1.5 text-xs text-destructive">Rate per gram is required</p> : null}
        </div>
        <div />

        <div>
          <Label htmlFor="manual-gross">Gross Wt (g) *</Label>
          <WeightField id="manual-gross" value={grossWtG} onValueChange={setGrossWtG} />
          {!hasGrossWt ? <p className="mt-1.5 text-xs text-destructive">Gross weight is required</p> : null}
        </div>
        <div>
          <Label htmlFor="manual-stone-wt">Stone Wt (g)</Label>
          <WeightField id="manual-stone-wt" value={stoneWtG} onValueChange={setStoneWtG} />
        </div>
        <div>
          <Label htmlFor="manual-net">Net Wt (g) *</Label>
          {/* Read-only, same reasoning as TagForm.tsx's net field - always
              derived from gross - stone (the useState-diff block above),
              never typed directly. Letting it be freely overridden let a
              line ship with an inconsistent, even physically impossible,
              net weight (e.g. bigger than gross) straight onto an invoice. */}
          <Input id="manual-net" readOnly value={netWtG} />
          <p className="mt-1.5 text-xs text-muted-foreground">Auto-calculated: gross − stone weight.</p>
          {!hasNetWt ? <p className="mt-1.5 text-xs text-destructive">Net weight is required</p> : null}
        </div>
        <div />

        <div>
          <Label htmlFor="manual-making">Making Charge (₹)</Label>
          <button
            type="button"
            id="manual-making"
            onClick={() => setShowMakingDialog(true)}
            className="flex h-12 w-full items-center justify-between rounded-lg border border-input bg-card px-4 text-sm text-foreground hover:bg-muted/50"
          >
            <span>{formatInr(makingCharge)}</span>
            {MAKING_METHOD_BADGE[makingMethod] ? (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {MAKING_METHOD_BADGE[makingMethod]}
              </span>
            ) : null}
          </button>
        </div>
        <div>
          <Label htmlFor="manual-stone-charge">Stone Charge (₹)</Label>
          <NumberField id="manual-stone-charge" value={stoneCharge} onValueChange={setStoneCharge} />
        </div>
      </div>

      {hasDescription && hasGrossWt && hasNetWt && hasRate && hasPieces && !hasTotal ? (
        <p className="mt-4 text-xs text-destructive">
          This item&apos;s total comes to ₹0 - check the net weight and rate before adding it.
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" onClick={handleAdd} disabled={!canAdd}>
          Add Item
        </Button>
      </div>

      {showMakingDialog ? (
        <MakingChargeDialog
          onClose={() => setShowMakingDialog(false)}
          initialMethod={makingMethod}
          initialValue={makingValue}
          description={description}
          metal={metal}
          purity={purity}
          netWtG={Number(netWtG) || 0}
          ratePerGram={Number(ratePerGram) || 0}
          onApply={(result) => {
            setMakingMethod(result.makingMethod);
            setMakingValue(result.makingValue);
            setMakingCharge(result.makingCharge);
          }}
        />
      ) : null}
    </Dialog>
  );
}

export function ItemTable({ onBrowseTags }: { onBrowseTags: () => void }) {
  const items = useBillingStore((state) => state.items);
  const updateItem = useBillingStore((state) => state.updateItem);
  const itemErrors = useBillingStore((state) => state.itemErrors);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [openMakingRow, setOpenMakingRow] = useState<number | null>(null);

  // Stable across renders (only depends on the zustand action reference,
  // which zustand itself keeps stable) - this is what lets columnDefs below
  // stay a stable reference too, which is the actual fix for the
  // live-typing-loses-focus risk a naive port of this grid would have had.
  const handleFieldChange = useCallback(
    (rowIndex: number, field: EditableField, raw: string) => {
      const value = NUMERIC_FIELDS.has(field) ? Number(raw) || 0 : raw;
      const patch: Partial<Omit<BillingItem, "total">> = { [field]: value };

      // Reads the sibling fields via getState() (not a closed-over `items`
      // prop) specifically so this callback itself never needs to change
      // identity when items changes.
      const item = useBillingStore.getState().items[rowIndex];

      // Net weight stays auto-derived from gross - stone in the grid too,
      // matching ManualAddForm's exact behavior (same Math.max(0, gross -
      // stone), rounded to 3dp).
      if (field === "grossWtG" || field === "stoneWtG") {
        const gross = field === "grossWtG" ? (value as number) : item.grossWtG;
        const stone = field === "stoneWtG" ? (value as number) : item.stoneWtG;
        const net = Math.max(0, gross - stone);
        patch.netWtG = Math.round(net * 1000) / 1000;
      }

      // Making charge is locked from direct typing, but for "per_gram"/
      // "percent_metal" it's a live formula over net weight and rate/g - if
      // either changes here (including the net-weight auto-derive just
      // above), recompute it with the already-applied makingValue so the
      // stored ₹ figure never goes stale against the method it claims to
      // use. "fixed" rows have no formula, so nothing to recompute.
      if (
        (field === "grossWtG" || field === "stoneWtG" || field === "ratePerGram") &&
        item.makingMethod !== "fixed"
      ) {
        const netWtG = patch.netWtG ?? item.netWtG;
        const ratePerGram = field === "ratePerGram" ? (value as number) : item.ratePerGram;
        patch.makingCharge = calculateMakingCharge({
          method: item.makingMethod,
          value: item.makingValue,
          netWtG,
          ratePerGram,
        });
      }

      updateItem(rowIndex, patch);
    },
    [updateItem],
  );

  const handleApplyMakingCharge = useCallback(
    (rowIndex: number, result: { makingMethod: MakingMethod; makingValue: number; makingCharge: number }) => {
      updateItem(rowIndex, result);
    },
    [updateItem],
  );

  const columnDefs = useMemo<ColDef<BillingItem>[]>(() => {
    // Fixed widths, not flex - with 11 columns, flex forces every column to
    // shrink to fit the panel's width, which truncates header text
    // ("Gross Wt (g) *" becomes "G..."). Fixed widths sized to each
    // header's actual text let every column stay fully readable; the grid
    // scrolls horizontally instead, same tradeoff the original shadcn-table
    // version made with its own `min-w-[1140px]` + `overflow-x-auto`.
    const editable = (field: EditableField, headerName: string, width: number): ColDef<BillingItem> => ({
      headerName,
      width,
      headerClass: AG_GRID_HEADER_CLASS,
      cellRenderer: ItemFieldCell,
      cellRendererParams: { field, onFieldChange: handleFieldChange } satisfies EditCellExtra,
    });

    return [
      editable("description", "Description *", 220),
      editable("hsnCode", "HSN", 110),
      {
        headerName: "Tag",
        width: 150,
        headerClass: AG_GRID_HEADER_CLASS,
        valueGetter: (p) => p.data?.tagCode ?? "—",
      },
      editable("buyerCode", "Buyer Code", 140),
      { field: "metal", headerName: "Metal", width: 110, headerClass: AG_GRID_HEADER_CLASS },
      { field: "purity", headerName: "Purity", width: 100, headerClass: AG_GRID_HEADER_CLASS },
      {
        headerName: "Pcs *",
        width: 90,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: PiecesCell,
        cellRendererParams: { field: "pieces", onFieldChange: handleFieldChange } satisfies EditCellExtra,
      },
      editable("grossWtG", "Gross Wt (g) *", 140),
      editable("stoneWtG", "Stone Wt (g)", 130),
      {
        headerName: "Net Wt (g) *",
        width: 130,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: NetWeightCell,
      },
      editable("ratePerGram", "Rate/g *", 150),
      {
        headerName: "Making Charge",
        width: 150,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: MakingChargeCell,
        cellRendererParams: { onOpen: setOpenMakingRow } satisfies MakingChargeCellExtra,
      },
      editable("stoneCharge", "Stone Charge", 150),
      {
        field: "total",
        headerName: "Total",
        width: 170,
        headerClass: AG_GRID_HEADER_CLASS,
        cellClass: (p) => cn("font-semibold!", p.data && p.data.total > 0 ? "text-foreground!" : "text-destructive!"),
        valueFormatter: (p) => (p.value != null ? formatInr(p.value) : ""),
      },
      {
        headerName: "Action",
        width: 60,
        headerClass: AG_GRID_HEADER_CLASS,
        cellRenderer: RemoveCell,
      },
    ];
  }, [handleFieldChange]);

  // AG_GRID_DEFAULT_COL_DEF (sortable/filter both off) matters even more
  // here than on the app's other grids: every cell/action in this one is
  // keyed by node.rowIndex to mutate the zustand store's
  // positionally-ordered items array (there's no stable row id to sort by
  // instead). If a column were sortable, sorting would change the grid's
  // displayed row order without changing the store's array order, so the
  // next edit or Remove click would silently land on the wrong line item -
  // a real correctness bug for a money-handling grid, not a cosmetic one.

  const getRowClass = (params: RowClassParams<BillingItem>) => {
    if (!params.data || params.rowIndex == null) return undefined;
    const errors = { ...getLiveItemErrors(params.data), ...itemErrors[params.rowIndex] };
    return Object.keys(errors).length > 0 ? "bg-destructive/5!" : undefined;
  };

  // Consolidated below the grid instead of a second full-width row per
  // erroring item (what the shadcn-table version did via a <Fragment> pair
  // of <tr>s) - ag-grid's row model doesn't have an easy equivalent to
  // "two rows per data row", and every row with an issue already gets a
  // red tint via getRowClass plus red borders on its specific bad cell(s),
  // so this list is a secondary, not the only, error signal.
  const rowsWithErrors = items
    .map((item, index) => ({ index, errors: { ...getLiveItemErrors(item), ...itemErrors[index] } }))
    .filter((row) => Object.keys(row.errors).length > 0);

  return (
    <div className="panel p-5">
      {/* Scan input lives in this header row (not its own panel above) -
          keeps the add-item surface (scan / browse / manual) in one place,
          right next to the table it fills, instead of a separate card. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <h3 className="font-display text-xl text-foreground shrink-0">Items</h3>
        <div className="min-w-[220px] flex-1 lg:max-w-sm">
          <ScanInput />
        </div>
        <div className="flex shrink-0 gap-2 lg:ml-auto">
          <Button type="button" variant="outline" size="md" onClick={onBrowseTags}>
            <Search className="h-4 w-4" /> Browse Tags
          </Button>
          <Button type="button" variant="outline" size="md" onClick={() => setShowManualAdd(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          No items yet - scan a tag code above, browse available tags, or add one manually.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <AgGridReact<BillingItem>
              theme={agGridTheme}
              rowData={items}
              columnDefs={columnDefs}
              defaultColDef={AG_GRID_DEFAULT_COL_DEF}
              getRowId={(p) => p.data.id}
              getRowClass={getRowClass}
              domLayout="autoHeight"
              suppressCellFocus
              animateRows={false}
            />
          </div>
          {rowsWithErrors.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {rowsWithErrors.map(({ index, errors }) => (
                <li key={index} className="text-xs text-destructive">
                  Row {index + 1}:{" "}
                  {Object.entries(errors)
                    .map(([field, message]) => `${FIELD_LABELS[field] ?? field} - ${message}`)
                    .join(" · ")}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {showManualAdd ? <ManualAddForm onDone={() => setShowManualAdd(false)} /> : null}

      {openMakingRow != null && items[openMakingRow] ? (
        <MakingChargeDialog
          onClose={() => setOpenMakingRow(null)}
          initialMethod={items[openMakingRow].makingMethod}
          initialValue={items[openMakingRow].makingValue}
          description={items[openMakingRow].description}
          metal={items[openMakingRow].metal}
          purity={items[openMakingRow].purity}
          netWtG={items[openMakingRow].netWtG}
          ratePerGram={items[openMakingRow].ratePerGram}
          onApply={(result) => handleApplyMakingCharge(openMakingRow, result)}
        />
      ) : null}
    </div>
  );
}
