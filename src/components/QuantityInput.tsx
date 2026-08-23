"use client";

import * as React from "react";
import { TextFieldProps } from "@mui/material/TextField";
import SelectableTextField from "@/components/SelectableTextField";
import { formatQuantity } from "@/utils/formatters";
import {
  parseQuantityText,
  sanitizeQuantityDraft,
} from "@/utils/quantityInput";

type Props = Omit<TextFieldProps, "value" | "onChange" | "type" | "ref"> & {
  value: number;
  onValueChange: (value: number) => void;
  permiteDecimal?: boolean;
};

/**
 * Numeric quantity field for values owned by a parent as a `number`.
 *
 * Keeps the typed text as its own draft instead of re-deriving it from the
 * committed number on every keystroke: a Spanish mobile keypad emits "," and
 * "2," parses to 2, so echoing the parsed value back erased the separator
 * before the decimals could be typed. `type="number"` is avoided on purpose —
 * browsers reject the locale separator outright and do not honour `select()`.
 */
export default function QuantityInput({
  value,
  onValueChange,
  permiteDecimal = false,
  ...rest
}: Props) {
  const [draft, setDraft] = React.useState(() => formatQuantity(value));

  // Follow changes made elsewhere (steppers, chips, a reset), but never
  // rewrite a draft that already means this value — "2." would collapse to "2"
  // mid-typing.
  React.useEffect(() => {
    if (parseQuantityText(draft, permiteDecimal) !== value) {
      setDraft(formatQuantity(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Built outside JSX: spreading TextField's props union inline makes
  // TypeScript collapse it to the `standard` variant.
  const fieldProps = {
    ...rest,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = sanitizeQuantityDraft(e.target.value, permiteDecimal);
      setDraft(next);
      onValueChange(parseQuantityText(next, permiteDecimal) ?? 0);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setDraft(formatQuantity(value));
      rest.onBlur?.(e);
    },
    slotProps: {
      ...rest.slotProps,
      htmlInput: {
        inputMode: permiteDecimal ? "decimal" : "numeric",
        ...(rest.slotProps?.htmlInput as object),
      },
    },
  } as React.ComponentProps<typeof SelectableTextField>;

  return <SelectableTextField {...fieldProps} />;
}
