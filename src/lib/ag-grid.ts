import { ModuleRegistry, AllCommunityModule, themeQuartz, type ColDef } from "ag-grid-community";

// Registered once here - every ag-grid component just imports this file
// (for agGridTheme/AG_GRID_HEADER_CLASS) and gets this side effect for
// free, instead of each component registering modules independently.
// ES module caching means this only actually runs once no matter how many
// components import it.
ModuleRegistry.registerModules([AllCommunityModule]);

// Single source of truth for every ag-grid table's look in this app - maps
// ag-grid's theme params onto this project's existing design tokens (same
// CSS vars every shadcn component already reads) instead of accepting
// ag-grid's own default Quartz palette. Change this one object and every
// ag-grid table in the app re-themes together, instead of each component
// carrying its own slightly-drifting copy.
export const agGridTheme = themeQuartz.withParams({
  accentColor: "var(--gold)",
  backgroundColor: "var(--card)",
  foregroundColor: "var(--foreground)",
  borderColor: "var(--border)",
  headerTextColor: "var(--muted-foreground)",
  headerFontWeight: 500,
  oddRowBackgroundColor: "var(--card)",
  rowHoverColor: "var(--muted)",
  selectedRowBackgroundColor: "var(--muted)",
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  fontFamily: "var(--font-sans)",
  spacing: 7,
  // Taller rows/cells than ag-grid's dense default - scales the
  // auto-calculated row padding (not a hardcoded rowHeight) so it still
  // adapts correctly if fontFamily/spacing ever change.
  rowVerticalPaddingScale: 1.6,
});

// Applied via `headerClass` on every ColDef across every ag-grid table, so
// headers read the same way the shadcn Table's TableHead cells already do
// elsewhere in the app ("uppercase tracking-wide text-xs text-muted-foreground
// font-medium") - the `!` is Tailwind's important-modifier, needed since
// ag-grid's own header CSS has higher specificity than a plain utility class.
export const AG_GRID_HEADER_CLASS = "uppercase! tracking-wide! text-xs!";

// Pass as `defaultColDef` on every AgGridReact in the app. ag-grid defaults
// `sortable`/`filter` to `true` on every column (its own documented
// default, not something this app opted into) - none of the shadcn Table
// pages these grids replaced had clickable sort-by-header or per-column
// filter menus, so leaving ag-grid's default on would be a real,
// user-visible behavior change, not just a styling one. Worse on
// src/features/billing/components/ItemTable.tsx specifically: its cells
// are keyed by `node.rowIndex` to mutate a plain positionally-ordered
// array (no stable row id to sort by instead), so letting a column
// actually be sorted would silently point every subsequent edit/remove at
// the wrong line item - a correctness bug, not a cosmetic one. Disabled
// globally here so no future column on any grid can reintroduce either
// issue by omission.
export const AG_GRID_DEFAULT_COL_DEF: ColDef = { sortable: false, filter: false };
