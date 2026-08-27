"use client";

import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Collapse,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { DiscountApplicationResultItem } from "@/lib/discounts";

/**
 * «¿Tienes un código de descuento?» — one row at the foot of the basket.
 *
 * The redesign draws it as a 52px row with a chevron and 15px text, the
 * width of the panel, on the same rule the lines use. It used to be a small
 * text button with its own icon, floating inside a shadowed block.
 */

const ROW_SX = {
  width: "100%",
  minHeight: 52,
  px: 1.75,
  gap: 1,
  justifyContent: "flex-start",
  textAlign: "left",
  color: "text.secondary",
  fontSize: "0.9375rem",
} as const;

const APPLIED_SX = { px: 1.75, pt: 1.25 } as const;

const FIELDS_SX = { display: "flex", gap: 1, px: 1.75, pb: 1.5 } as const;

interface DiscountFieldProps {
  promoCode: string;
  applied: DiscountApplicationResultItem[];
  discountTotal: number;
  base: string;
  onCodeChange: (code: string) => void;
  onApply: () => void;
}

export function DiscountField({
  promoCode,
  applied,
  discountTotal,
  base,
  onCodeChange,
  onApply,
}: DiscountFieldProps) {
  const [open, setOpen] = useState(false);
  const hasDiscount = applied.length > 0;

  return (
    <Box>
      {hasDiscount && (
        <Typography
          variant="body2"
          fontWeight={600}
          color="success.main"
          sx={APPLIED_SX}
        >
          Descuento aplicado: −{formatMontoEnMoneda(discountTotal, base)}
        </Typography>
      )}

      <ButtonBase
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        sx={ROW_SX}
      >
        {open ? (
          <ExpandLessIcon fontSize="small" />
        ) : (
          <ExpandMoreIcon fontSize="small" />
        )}
        {hasDiscount
          ? "Código de descuento"
          : "¿Tienes un código de descuento?"}
      </ButtonBase>

      <Collapse in={open}>
        <Box sx={FIELDS_SX}>
          <TextField
            label="Código de descuento"
            value={promoCode}
            onChange={(event) => onCodeChange(event.target.value.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") onApply();
            }}
            size="small"
            fullWidth
            sx={{ "& .MuiOutlinedInput-root": { minHeight: 44 } }}
          />
          <Button
            variant="contained"
            onClick={onApply}
            sx={{ minWidth: 90, minHeight: 44 }}
            size="small"
          >
            Aplicar
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
