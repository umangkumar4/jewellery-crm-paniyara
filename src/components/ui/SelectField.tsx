"use client";

import { forwardRef } from "react";
import ReactSelect, { type Props as ReactSelectProps, type SelectInstance } from "react-select";
import { getReactSelectClassNames, type SelectOption } from "./react-select-styles";

export type { SelectOption };

export interface SelectFieldProps<Option extends SelectOption = SelectOption>
  extends Pick<
    ReactSelectProps<Option, false>,
    | "options"
    | "value"
    | "onChange"
    | "placeholder"
    | "isDisabled"
    | "isClearable"
    | "name"
    | "id"
    | "inputId"
  > {
  className?: string;
  hasError?: boolean;
}

function SelectFieldInner<Option extends SelectOption = SelectOption>(
  { className, hasError, ...props }: SelectFieldProps<Option>,
  ref: React.Ref<SelectInstance<Option, false>>,
) {
  return (
    <ReactSelect<Option, false>
      ref={ref}
      unstyled
      isSearchable={false}
      classNamePrefix="select-field"
      className={className}
      classNames={getReactSelectClassNames<Option>(hasError)}
      {...props}
    />
  );
}

export const SelectField = forwardRef(SelectFieldInner) as <
  Option extends SelectOption = SelectOption,
>(
  props: SelectFieldProps<Option> & { ref?: React.Ref<SelectInstance<Option, false>> },
) => ReturnType<typeof SelectFieldInner>;
