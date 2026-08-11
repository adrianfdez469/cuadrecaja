"use client";

import {
  Box,
  Button,
  Drawer,
  Radio,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { formatChangeSplit, formatMontoEnMoneda } from "@/utils/formatters";
import type { ChangeErrors, ChangeOption } from "@/app/pos/utils/changeMath";

interface ChangeSheetProps {
  open: boolean;
  options: ChangeOption[];
  selectedId: string | null;
  /** Splits the drawer cannot cover — still selectable, but marked. */
  unavailableIds: Set<string>;
  /** Drawer shortfalls for the currently selected split. */
  errors: ChangeErrors;
  changeTotalBase: number;
  base: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}

/**
 * Picks how to hand the change over. Every row is a complete, pre-computed
 * split, so there is no arithmetic for the cashier to get wrong and no way
 * to leave the drawer holding an amount that does not add up.
 */
export function ChangeSheet({
  open,
  options,
  selectedId,
  unavailableIds,
  errors,
  changeTotalBase,
  base,
  onClose,
  onSelect,
}: ChangeSheetProps) {
  const theme = useTheme();
  const firstError = Object.values(errors).find((error) => error !== null);

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
        gap={1.25}
        sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
        >
          <Typography variant="caption" color="text.secondary">
            CÓMO DAR EL CAMBIO
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatMontoEnMoneda(changeTotalBase, base)} a dar
          </Typography>
        </Stack>

        <Stack gap={0.75}>
          {options.map((option) => {
            const selected = option.id === selectedId;
            const unavailable = unavailableIds.has(option.id);
            return (
              <Box
                key={option.id}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => onSelect(option.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(option.id);
                  }
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1.25,
                  minHeight: 56,
                  borderRadius: 2,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: selected ? "primary.main" : "divider",
                  bgcolor: selected
                    ? alpha(theme.palette.primary.main, 0.08)
                    : "transparent",
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2,
                  },
                }}
              >
                <Radio checked={selected} tabIndex={-1} size="small" />
                <Typography
                  variant="body1"
                  fontWeight={selected ? 700 : 500}
                  color={unavailable ? "text.disabled" : "text.primary"}
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatChangeSplit(option.distribution)}
                </Typography>
                <Box flex={1} />
                {unavailable && (
                  <Typography variant="caption" color="error">
                    Sin saldo
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>

        {firstError && (
          <Typography variant="caption" color="error">
            En caja hay{" "}
            {formatMontoEnMoneda(firstError.available, firstError.currency)}.
            Elige otra forma de dar el cambio.
          </Typography>
        )}

        <Button variant="contained" onClick={onClose} sx={{ minHeight: 48 }}>
          Listo
        </Button>
      </Stack>
    </Drawer>
  );
}
