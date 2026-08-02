"use client";

import { useEffect, useState } from "react";
import { Box, Button, Chip, Typography, useTheme } from "@mui/material";
import SelectableTextField from "@/components/SelectableTextField";
import {
  clampQuantity,
  getDefaultStep,
  getStepChips,
  resolveCommittedQuantity,
} from "@/app/pos/utils/quantityInput";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  allowDecimal: boolean;
  showBulkChip10: boolean;
  showBulkChip50: boolean;
  showBulkChip100: boolean;
  disabled: boolean;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChange,
  min,
  max,
  allowDecimal,
  showBulkChip10,
  showBulkChip50,
  showBulkChip100,
  disabled,
}) => {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [activeStep, setActiveStep] = useState(getDefaultStep(allowDecimal));

  // Defensive companion to the QuantityDialog fix: QuantityStepper doesn't
  // unmount between product switches (e.g. scanner selecting a new product
  // while the dialog is already open), so activeStep can otherwise survive
  // a switch between decimal and integer products, referencing a step value
  // that isn't in the new product's chip set. Reset it whenever allowDecimal
  // changes so it always matches the current product's step domain.
  useEffect(() => {
    setActiveStep(getDefaultStep(allowDecimal));
  }, [allowDecimal]);

  const chips = getStepChips(
    allowDecimal,
    showBulkChip10,
    showBulkChip50,
    showBulkChip100,
  );

  const startEditing = () => {
    if (disabled || editing) return;
    setDraftText(String(value));
    setEditing(true);
  };

  const commitEditing = () => {
    const next = resolveCommittedQuantity(
      draftText,
      value,
      min,
      max,
      allowDecimal,
    );
    onChange(next);
    setEditing(false);
  };

  const handleDraftChange = (text: string) => {
    const cleaned = allowDecimal
      ? text.replace(/[^0-9.]/g, "")
      : text.replace(/[^0-9]/g, "");
    setDraftText(cleaned);
  };

  const step = (delta: number) => {
    onChange(clampQuantity(value + delta, min, max, allowDecimal));
  };

  const boxSx = {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 2,
    height: { xs: 72, sm: 88 },
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  };

  if (disabled) {
    return (
      <Box sx={boxSx}>
        <Typography
          sx={{ fontSize: { xs: "2rem", sm: "2.5rem" }, fontWeight: 700 }}
          color="text.disabled"
        >
          0
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap={1.5}
      width="100%"
    >
      <Box display="flex" alignItems="center" gap={1.5} width="100%">
        <Button
          variant="contained"
          onClick={() => step(-activeStep)}
          disabled={value - activeStep < min}
        >
          −{activeStep}
        </Button>

        <Box onClick={startEditing} sx={{ ...boxSx, flex: 1, cursor: "text" }}>
          {editing ? (
            <SelectableTextField
              autoFocus
              value={draftText}
              onChange={(e) => handleDraftChange(e.target.value)}
              onBlur={commitEditing}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // SelectableTextField spreads onKeyDown into MUI's TextField,
                  // which only routes onChange/onBlur/onFocus to the inner
                  // <input> explicitly; onKeyDown falls through to the root
                  // FormControl wrapper. A bubbled keydown's target is still
                  // the focused <input>, so use that instead of currentTarget.
                  (e.target as HTMLInputElement).blur();
                }
              }}
              inputProps={{
                inputMode: allowDecimal ? "decimal" : "numeric",
                style: {
                  textAlign: "center",
                  fontSize: "2rem",
                  fontWeight: 700,
                },
              }}
              variant="standard"
              sx={{ width: "100%" }}
            />
          ) : (
            <Typography
              sx={{
                fontSize: { xs: "2rem", sm: "2.5rem" },
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          onClick={() => step(activeStep)}
          disabled={value + activeStep > max}
        >
          +{activeStep}
        </Button>
      </Box>

      <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center">
        {chips.map((chip) => (
          <Chip
            key={chip.value}
            label={chip.label}
            color={chip.value === activeStep ? "primary" : "default"}
            variant={chip.value === activeStep ? "filled" : "outlined"}
            onClick={() => setActiveStep(chip.value)}
          />
        ))}
      </Box>
    </Box>
  );
};
