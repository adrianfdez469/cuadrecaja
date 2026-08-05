"use client";

import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { PaymentLineKind } from "@/app/pos/utils/paymentMath";

export interface PaymentOption {
  kind: PaymentLineKind;
  currency: string;
  /** Pending amount expressed in this option's currency. */
  suggested: number;
  /** Base equivalent of `suggested`, or null when this is the base currency. */
  equivalentBase: number | null;
}

interface AddPaymentSheetProps {
  open: boolean;
  options: PaymentOption[];
  base: string;
  onClose: () => void;
  onPick: (option: PaymentOption) => void;
}

export function AddPaymentSheet({
  open,
  options,
  base,
  onClose,
  onPick,
}: AddPaymentSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // See AmountKeypad.tsx: the pinned cart sidebar and the mobile
      // CartDrawer sit at theme.zIndex.drawer + 1, and this Drawer portals to
      // document.body regardless of nesting, so it needs an explicit zIndex
      // above them or it renders behind whichever one is on screen.
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
      PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
    >
      <Stack
        gap={1}
        sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <Typography variant="caption" color="text.secondary">
          AGREGAR FORMA DE PAGO
        </Typography>

        {options.length === 0 ? (
          <Typography variant="body2" color="text.secondary" py={2}>
            No hay otras formas de pago configuradas para este negocio.
          </Typography>
        ) : (
          <List disablePadding>
            {options.map((option) => (
              <ListItemButton
                key={`${option.kind}-${option.currency}`}
                onClick={() => onPick(option)}
                sx={{
                  minHeight: 44,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  mb: 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {option.kind === "cash" ? (
                    <PaymentsOutlinedIcon fontSize="small" />
                  ) : (
                    <CreditCardIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={`${option.kind === "cash" ? "Efectivo" : "Transferencia"} ${option.currency}`}
                  secondary={
                    option.suggested > 0
                      ? option.equivalentBase !== null
                        ? `Sugerido: ${formatMontoEnMoneda(option.suggested, option.currency)} · ≈ ${formatMontoEnMoneda(option.equivalentBase, base)}`
                        : `Sugerido: ${formatMontoEnMoneda(option.suggested, option.currency)}`
                      : "Ya está cubierto el total"
                  }
                  primaryTypographyProps={{ fontWeight: 600, variant: "body2" }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Stack>
    </Drawer>
  );
}
