"use client";

import { useState } from "react";
import { Box, Button, Collapse, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { DiscountApplicationResultItem } from "@/lib/discounts";

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
        <Typography variant="body2" fontWeight={600} color="success.main">
          Descuento aplicado: −{discountTotal.toFixed(2)} {base}
        </Typography>
      )}

      <Button
        variant="text"
        size="small"
        onClick={() => setOpen((value) => !value)}
        startIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ textTransform: "none", color: "text.secondary", minHeight: 44 }}
      >
        {hasDiscount ? "Cambiar código" : "¿Tenés un código de descuento?"}
      </Button>

      <Collapse in={open}>
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
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
