import * as React from "react";
import InputAdornment from "@mui/material/InputAdornment";
import { TextFieldProps } from "@mui/material/TextField";
import SelectableTextField from "./SelectableTextField";

/**
 * SelectableTextField preconfigured for percentages: decimal keyboard on
 * mobile via inputMode (not type="number", which browsers may not select()
 * on) and a trailing "%" adornment.
 */
const PercentageField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ InputProps, inputProps, ...other }, ref) => (
    <SelectableTextField
      {...other}
      ref={ref}
      inputProps={{ inputMode: "decimal", ...inputProps }}
      InputProps={{
        endAdornment: <InputAdornment position="end">%</InputAdornment>,
        ...InputProps,
      }}
    />
  ),
);

PercentageField.displayName = "PercentageField";

export default PercentageField;
