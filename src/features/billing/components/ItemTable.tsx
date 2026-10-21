"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, RowClassParams } from "ag-grid-community";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { agGridTheme, AG_GRID_HEADER_CLASS, AG_GRID_DEFAULT_COL_DEF } from "@/lib/ag-grid";
import { cn } from "@/lib/utils";
import { METALS, type Metal } from "@/lib/metals";
import { useMetalPurities } from "@/features/settings/hooks/useMetalPurities";
import { NumberField } from "@/features/billing/components/NumberField";
import { sanitizeNumericInput, isValidNumericInput } from "@/features/billing/lib/numericInput";
import { useNumericStoreField } from "@/features/billing/lib/useNumericStoreField";
import { useBillingStore, type BillingItem } from "@/store/useBillingStore";

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
  | "makingCharge"
  | "stoneCharge";

const NUMERIC_FIELDS = new Set<EditableField>([
  "pieces",
  "grossWtG",
  "stoneWtG",
  "netWtG",
  "ratePerGram",
  "makingCharge",
  "stoneCharge",
]);

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
  makingCharge: "making_charge",
  stoneCharge: "stone_charge",
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
        if (!isValidNumericInput(raw)) return;
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
  const [makingCharge, setMakingCharge] = useState("0");
  const [stoneCharge, setStoneCharge] = useState("0");

  const { data: purities } = useMetalPurities({ metal });
  const hasPurities = !!purities && purities.length > 0;

  // Adjusted during render (same pattern as TagsTable.tsx's filter-driven
  // page reset) rather than in a useEffect - a fresh purities list for a
  // newly-selected metal is exactly the "derive state from a prop change"
  // case React's docs recommend this for, and it avoids an extra commit.
  const [prevPurities, setPrevPurities] = useState(purities);
  if (purities !== prevPurities) {
    setPrevPurities(purities);
    if (purities && !purities.some((p) => p.purity === purity)) {
      const first = purities[0];
      setPurity(first?.purity ?? "");
      setRatePerGram(String(first?.rate_per_gram ?? 0));
    }
  }

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

  // Description, gross/net weight, and rate per gram are mandatory - a
  // physical item being billed can't have a nameless, weightless, or
  // unpriced line. Stone weight is deliberately NOT required here: a plain
  // gold band genuinely has zero stone weight, that's a valid real value,
  // not a missing one (see docs/billing-plan.md).
  const hasDescription = description.trim().length > 0;
  const hasGrossWt = Number(grossWtG) > 0;
  const hasNetWt = Number(netWtG) > 0;
  const hasRate = Number(ratePerGram) > 0;
  const canAdd = hasDescription && hasGrossWt && hasNetWt && hasRate;

  const handleAdd = () => {
    if (!canAdd) return;
    addItem({
      tagCode: null,
      description: description.trim(),
      hsnCode: hsnCode.trim(),
      metal,
      purity,
      pieces: Number(pieces) || 1,
      grossWtG: Number(grossWtG) || 0,
      stoneWtG: Number(stoneWtG) || 0,
      netWtG: Number(netWtG) || 0,
      ratePerGram: Number(ratePerGram) || 0,
      makingCharge: Number(makingCharge) || 0,
      stoneCharge: Number(stoneCharge) || 0,
    });
    onDone();
  };

  return (
    // Wider than Dialog's default max-w-lg - this form's 4-column grid of
    // labeled numeric fields needs more room than a typical modal's content.
    // dimBackground={false} per explicit request - keeps the billing page
    // visible behind this one dialog (TagBrowseDialog's overlay is
    // untouched, this wasn't asked to change there).
    <Dialog open onClose={onDone} title="Add Item" className="max-w-2xl" dimBackground={false}>
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
          <Label htmlFor="manual-pieces">Pieces</Label>
          <NumberField id="manual-pieces" value={pieces} onValueChange={setPieces} />
        </div>

        <div>
          <Label htmlFor="manual-metal">Metal</Label>
          <Select
            id="manual-metal"
            value={metal}
            onChange={(e) => {
              setMetal(e.target.value as Metal);
              setPurity("");
            }}
          >
            {METALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="manual-purity">Purity</Label>
          <Select
            id="manual-purity"
            disabled={!hasPurities}
            value={purity}
            onChange={(e) => {
              setPurity(e.target.value);
              const match = purities?.find((p) => p.purity === e.target.value);
              setRatePerGram(String(match?.rate_per_gram ?? 0));
            }}
          >
            {hasPurities ? (
              purities!.map((p) => (
                <option key={p.id} value={p.purity}>
                  {p.purity}
                </option>
              ))
            ) : (
              <option value="">No purities yet</option>
            )}
          </Select>
        </div>
        <div>
          <Label htmlFor="manual-rate">Rate/g (₹) *</Label>
          <NumberField id="manual-rate" value={ratePerGram} onValueChange={setRatePerGram} />
          {!hasRate ? <p className="mt-1.5 text-xs text-destructive">Rate per gram is required</p> : null}
        </div>
        <div />

        <div>
          <Label htmlFor="manual-gross">Gross Wt (g) *</Label>
          <NumberField id="manual-gross" value={grossWtG} onValueChange={setGrossWtG} />
          {!hasGrossWt ? <p className="mt-1.5 text-xs text-destructive">Gross weight is required</p> : null}
        </div>
        <div>
          <Label htmlFor="manual-stone-wt">Stone Wt (g)</Label>
          <NumberField id="manual-stone-wt" value={stoneWtG} onValueChange={setStoneWtG} />
        </div>
        <div>
          <Label htmlFor="manual-net">Net Wt (g) *</Label>
          <NumberField id="manual-net" value={netWtG} onValueChange={setNetWtG} />
          {!hasNetWt ? <p className="mt-1.5 text-xs text-destructive">Net weight is required</p> : null}
        </div>
        <div />

        <div>
          <Label htmlFor="manual-making">Making Charge (₹)</Label>
          <NumberField id="manual-making" value={makingCharge} onValueChange={setMakingCharge} />
        </div>
        <div>
          <Label htmlFor="manual-stone-charge">Stone Charge (₹)</Label>
          <NumberField id="manual-stone-charge" value={stoneCharge} onValueChange={setStoneCharge} />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" onClick={handleAdd} disabled={!canAdd}>
          Add Item
        </Button>
      </div>
    </Dialog>
  );
}

export function ItemTable({ onBrowseTags }: { onBrowseTags: () => void }) {
  const items = useBillingStore((state) => state.items);
  const updateItem = useBillingStore((state) => state.updateItem);
  const itemErrors = useBillingStore((state) => state.itemErrors);
  const [showManualAdd, setShowManualAdd] = useState(false);

  // Stable across renders (only depends on the zustand action reference,
  // which zustand itself keeps stable) - this is what lets columnDefs below
  // stay a stable reference too, which is the actual fix for the
  // live-typing-loses-focus risk a naive port of this grid would have had.
  const handleFieldChange = useCallback(
    (rowIndex: number, field: EditableField, raw: string) => {
      const value = NUMERIC_FIELDS.has(field) ? Number(raw) || 0 : raw;
      const patch: Partial<Omit<BillingItem, "total">> = { [field]: value };

      // Net weight stays auto-derived from gross - stone in the grid too,
      // matching ManualAddForm's exact behavior (same Math.max(0, gross -
      // stone), rounded to 3dp). Reads the sibling weight via getState()
      // (not a closed-over `items` prop) specifically so this callback
      // itself never needs to change identity when items changes.
      if (field === "grossWtG" || field === "stoneWtG") {
        const item = useBillingStore.getState().items[rowIndex];
        const gross = field === "grossWtG" ? (value as number) : item.grossWtG;
        const stone = field === "stoneWtG" ? (value as number) : item.stoneWtG;
        const net = Math.max(0, gross - stone);
        patch.netWtG = Math.round(net * 1000) / 1000;
      }

      updateItem(rowIndex, patch);
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
      {
        headerName: "Tag",
        width: 150,
        headerClass: AG_GRID_HEADER_CLASS,
        valueGetter: (p) => p.data?.tagCode ?? "—",
      },
      { field: "metal", headerName: "Metal", width: 110, headerClass: AG_GRID_HEADER_CLASS },
      { field: "purity", headerName: "Purity", width: 100, headerClass: AG_GRID_HEADER_CLASS },
      editable("grossWtG", "Gross Wt (g) *", 140),
      editable("stoneWtG", "Stone Wt (g)", 130),
      editable("netWtG", "Net Wt (g) *", 130),
      editable("ratePerGram", "Rate/g *", 150),
      editable("makingCharge", "Making Charge", 150),
      editable("stoneCharge", "Stone Charge", 150),
      {
        field: "total",
        headerName: "Total",
        width: 170,
        headerClass: AG_GRID_HEADER_CLASS,
        cellClass: "font-semibold! text-foreground!",
        valueFormatter: (p) => (p.value != null ? `₹${p.value.toLocaleString("en-IN")}` : ""),
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
    <div className="panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-xl text-foreground">Items</h3>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="md" onClick={() => setShowManualAdd(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
          <Button type="button" variant="outline" size="md" onClick={onBrowseTags}>
            Browse Tags
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          No items yet - scan a tag code above, browse available tags, or add one manually.
        </p>
      ) : (
        <>
          <div className="mt-5">
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
    </div>
  );
}
