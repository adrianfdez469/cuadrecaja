"use client";

import type { ReactNode } from "react";
import { Box, ButtonBase, Drawer, Typography } from "@mui/material";
import { shape, touch } from "@/theme";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** «Agregar forma de pago», «Cómo dar el cambio», «Propina». */
  title: string;
  children: ReactNode;
  /** The primary action, when the sheet has one — «Listo». */
  primaryLabel?: string;
  onPrimary?: () => void;
  /** The quiet one beside it — «Quitar». */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * The checkout's sheet: a white panel from the bottom edge with a grab
 * handle, a 17px title and — when it has actions — «Listo» and «Quitar»
 * inside the sheet itself, never under the fold. In production the change
 * sheet's «Listo» sat below the visible area on a 686px phone.
 */

const PAPER_SX = {
  borderTopLeftRadius: `${shape.radius.lg}px`,
  borderTopRightRadius: `${shape.radius.lg}px`,
  pb: "calc(10px + env(safe-area-inset-bottom))",
  maxHeight: "88dvh",
} as const;

const GRAB_SX = {
  width: 36,
  height: 4,
  borderRadius: 2,
  bgcolor: "divider",
  mx: "auto",
  mt: 1.25,
  mb: 0.5,
} as const;

const TITLE_SX = {
  px: 2,
  pt: 1,
  pb: 0.5,
  fontSize: "1.0625rem",
  fontWeight: 700,
} as const;

const FOOT_SX = {
  display: "flex",
  gap: 1.125,
  px: 2,
  pt: 1.5,
  pb: 1,
} as const;

const PRIMARY_SX = {
  flex: 1,
  height: touch.comfortable,
  borderRadius: `${shape.radius.md}px`,
  bgcolor: "primary.main",
  color: "primary.contrastText",
  fontSize: "1rem",
  fontWeight: 700,
} as const;

const SECONDARY_SX = {
  flex: "0 0 auto",
  px: 2.5,
  height: touch.comfortable,
  borderRadius: `${shape.radius.md}px`,
  border: "1.5px solid",
  borderColor: "divider",
  color: "text.secondary",
  fontSize: "0.9375rem",
  fontWeight: 600,
} as const;

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: BottomSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // The pinned cart sidebar and the mobile CartDrawer sit at
      // theme.zIndex.drawer + 1, and this Drawer portals to document.body
      // regardless of nesting, so it needs an explicit zIndex above them.
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
      PaperProps={{ sx: PAPER_SX }}
    >
      <Box sx={GRAB_SX} />
      <Typography component="h2" sx={TITLE_SX}>
        {title}
      </Typography>
      <Box sx={{ overflowY: "auto" }}>{children}</Box>
      {(primaryLabel || secondaryLabel) && (
        <Box sx={FOOT_SX}>
          {primaryLabel && (
            <ButtonBase onClick={onPrimary} sx={PRIMARY_SX}>
              {primaryLabel}
            </ButtonBase>
          )}
          {secondaryLabel && (
            <ButtonBase onClick={onSecondary} sx={SECONDARY_SX}>
              {secondaryLabel}
            </ButtonBase>
          )}
        </Box>
      )}
    </Drawer>
  );
}

/** One 56px row of a sheet: whatever it carries, on a 1px rule. */
export const SHEET_ROW_SX = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 1.5,
  minHeight: touch.row,
  px: 2,
  borderTop: "1px solid",
  borderColor: "divider",
  fontSize: "0.9375rem",
  textAlign: "left",
  "&:first-of-type": { borderTop: "none" },
} as const;

/** The radio of a sheet row: a 22px ring, filled to a 7px ring when on. */
export function SheetRadio({ on }: { on: boolean }) {
  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        flex: "0 0 22px",
        borderRadius: "50%",
        border: on ? "7px solid" : "2px solid",
        borderColor: on ? "primary.main" : "divider",
        boxSizing: "border-box",
      }}
    />
  );
}
