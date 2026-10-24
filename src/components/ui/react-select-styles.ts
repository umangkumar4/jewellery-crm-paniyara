import type { ClassNamesConfig, GroupBase } from "react-select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}

export const toOptions = (values: readonly string[]): SelectOption[] =>
  values.map((v) => ({ label: v, value: v }));

export function getReactSelectClassNames<
  Option extends SelectOption,
  IsMulti extends boolean = false,
>(hasError?: boolean): ClassNamesConfig<Option, IsMulti, GroupBase<Option>> {
  return {
    control: (state) =>
      cn(
        "h-12 w-full rounded-lg border bg-card px-1 text-sm text-foreground transition",
        hasError ? "border-destructive" : "border-input",
        state.isFocused && "ring-2 ring-ring",
        state.isDisabled && "cursor-not-allowed opacity-60",
      ),
    valueContainer: () => "gap-1 px-2",
    input: () => "text-foreground",
    placeholder: () => "text-muted-foreground",
    singleValue: () => "text-foreground",
    indicatorsContainer: () => "text-muted-foreground",
    dropdownIndicator: () => "px-2",
    clearIndicator: () => "px-2",
    indicatorSeparator: () => "bg-border",
    menu: () => "z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-md",
    menuList: () => "max-h-60 overflow-auto p-1",
    option: (state) =>
      cn(
        "cursor-pointer rounded-md px-3 py-2 text-sm",
        state.isFocused && "bg-accent text-accent-foreground",
        state.isSelected && "bg-secondary font-medium text-secondary-foreground",
      ),
    noOptionsMessage: () => "px-3 py-2 text-sm text-muted-foreground",
    loadingMessage: () => "px-3 py-2 text-sm text-muted-foreground",
    multiValue: () => "gap-1 rounded-md bg-secondary px-1.5 py-0.5",
    multiValueLabel: () => "text-xs text-secondary-foreground",
    multiValueRemove: () => "text-secondary-foreground hover:text-destructive",
  };
}
