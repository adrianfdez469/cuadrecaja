import * as React from "react";
import InputAdornment from "@mui/material/InputAdornment";
import { TextFieldProps } from "@mui/material/TextField";
import SelectableTextField from "./SelectableTextField";

type MoneyFieldProps = TextFieldProps & {
  currencySymbol?: React.ReactNode;
};

/**
 * SelectableTextField preconfigured for money amounts: decimal keyboard on
 * mobile via inputMode (not type="number", which browsers may not select()
 * on) and a currency adornment, overridable per field (e.g. a symbol that
 * depends on the selected currency).
 */
const MoneyField = React.forwardRef<HTMLInputElement, MoneyFieldProps>(
  ({ currencySymbol = "$", InputProps, inputProps, ...other }, ref) => (
    <SelectableTextField
      {...other}
      ref={ref}
      inputProps={{ inputMode: "decimal", ...inputProps }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">{currencySymbol}</InputAdornment>
        ),
        ...InputProps,
      }}
    />
  ),
);

MoneyField.displayName = "MoneyField";

export default MoneyField;
