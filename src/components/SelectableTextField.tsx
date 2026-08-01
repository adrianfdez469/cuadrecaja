import * as React from "react";
import TextField, { TextFieldProps } from "@mui/material/TextField";

/**
 * Drop-in replacement for MUI's TextField that selects the whole value on focus,
 * so the user can overwrite it immediately (mobile taps, desktop tabbing, etc).
 * Opt in per field — use it only where "replace the whole value" is the expected
 * interaction (quantities, prices, single-value fields), not for free text.
 */
const SelectableTextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ onFocus, multiline, ...other }, ref) => {
    const handleFocus = (
      event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      // Multiline fields are meant for partial edits, not full replacement.
      if (!multiline) {
        // Deferred: selecting synchronously on focus can be undone by the
        // browser's own cursor placement on the mouseup that follows a click
        // into an unfocused field. Running after that settles wins reliably.
        const target = event.target;
        setTimeout(() => target.select(), 0);
      }
      onFocus?.(event);
    };

    return (
      <TextField
        {...other}
        multiline={multiline}
        inputRef={ref}
        onFocus={handleFocus}
      />
    );
  },
);

SelectableTextField.displayName = "SelectableTextField";

export default SelectableTextField;
