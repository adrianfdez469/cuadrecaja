"use client";

import { useEffect, useState } from "react";
import { Box, Button, Chip, Typography, useTheme } from "@mui/material";
import SelectableTextField from "@/components/SelectableTextField";
import { formatQuantity } from "@/utils/formatters";
import {
  clampQuantity,
  getDefaultStep,
  getStepChips,
  parseQuantityText,
  resolveCommittedQuantity,
  sanitizeQuantityDraft,
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
  const [activeStep, setActiveStep] = useState(getDefaultStep());

  // Defensive companion to the QuantityDialog fix: QuantityStepper doesn't
  // unmount between product switches (e.g. scanner selecting a new product
  // while the dialog is already open), so activeStep can otherwise survive
  // a switch between decimal and integer products, referencing a step value
  // (e.g. 10/50/100) that isn't in the new product's chip set. Reset it back
  // to the default whenever allowDecimal changes so it always matches the
  // current product's step domain.
  useEffect(() => {
    setActiveStep(getDefaultStep());
  }, [allowDecimal]);

  const chips = getStepChips(
    allowDecimal,
    showBulkChip10,
    showBulkChip50,
    showBulkChip100,
  );

  const startEditing = () => {
    if (disabled || editing) return;
    setDraftText(formatQuantity(value));
    setEditing(true);
  };

  // Aplica en cada tecleo válido (no solo al perder foco) — en móvil el
  // teclado numérico no siempre tiene "Enter"/"Listo", y una cantidad por
  // encima del máximo debe caer automáticamente al máximo permitido al
  // instante, sin esperar a que se toque afuera.
  const stopEditing = () => setEditing(false);

  const handleDraftChange = (text: string) => {
    // Normaliza "," a "." (teclados numéricos en español) y limita a 2
    // decimales visualmente mientras se escribe, no solo al confirmar.
    const cleaned = sanitizeQuantityDraft(text, allowDecimal);
    const parsed = parseQuantityText(cleaned, allowDecimal);

    if (parsed === null) {
      setDraftText(cleaned);
      return;
    }

    const clamped = resolveCommittedQuantity(
      cleaned,
      value,
      min,
      max,
      allowDecimal,
    );
    onChange(clamped);
    // Si el tope obligó a bajar el valor, el texto visible debe reflejarlo
    // al instante — no solo el estado interno, tocar afuera no debería ser
    // necesario para verlo.
    setDraftText(clamped !== parsed ? formatQuantity(clamped) : cleaned);
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

        <Box
          onClick={startEditing}
          sx={{ ...boxSx, flex: 1, minWidth: 0, cursor: "text" }}
        >
          {editing ? (
            <SelectableTextField
              autoFocus
              value={draftText}
              onChange={(e) => handleDraftChange(e.target.value)}
              onBlur={stopEditing}
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
              {formatQuantity(value)}
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
