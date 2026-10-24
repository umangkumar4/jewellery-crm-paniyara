"use client";

import { forwardRef } from "react";
import ReactSelect, { type Props as ReactSelectProps, type SelectInstance } from "react-select";
import { getReactSelectClassNames, type SelectOption } from "./react-select-styles";

export type { SelectOption };

export interface AutoCompleteSelectProps<
  Option extends SelectOption = SelectOption,
  IsMulti extends boolean = false,
> extends Pick<
    ReactSelectProps<Option, IsMulti>,
    | "options"
    | "value"
    | "onChange"
    | "placeholder"
    | "isDisabled"
    | "isClearable"
    | "isMulti"
    | "isLoading"
    | "onInputChange"
    | "name"
    | "id"
    | "inputId"
  > {
  className?: string;
  hasError?: boolean;
}

function AutoCompleteSelectInner<
  Option extends SelectOption = SelectOption,
  IsMulti extends boolean = false,
>(
  { className, hasError, ...props }: AutoCompleteSelectProps<Option, IsMulti>,
  ref: React.Ref<SelectInstance<Option, IsMulti>>,
) {
  return (
    <ReactSelect<Option, IsMulti>
      ref={ref}
      unstyled
      isSearchable
      isClearable
      classNamePrefix="autocomplete-select"
      className={className}
      classNames={getReactSelectClassNames<Option, IsMulti>(hasError)}
      {...props}
    />
  );
}

export const AutoCompleteSelect = forwardRef(AutoCompleteSelectInner) as <
  Option extends SelectOption = SelectOption,
  IsMulti extends boolean = false,
>(
  props: AutoCompleteSelectProps<Option, IsMulti> & {
    ref?: React.Ref<SelectInstance<Option, IsMulti>>;
  },
) => ReturnType<typeof AutoCompleteSelectInner>;
