"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

interface AdjustmentRowProps {
  /** «Descuento», «Propina». */
  title: string;
  /** What it does, in one line. */
  hint: string;
  /** «Ninguno», «−215,90». */
  value: string;
  /** The code under the value, once there is an amount. */
  valueCode?: string;
  /** An adjustment in force: the accent wash and the value in violet. */
  active?: boolean;
  /** Absent when the row is only stating a fact. */
  onClick?: () => void;
}

/**
 * One adjustment of the sale, as the redesign draws it: a 56px row with the
 * name, what it does, and its current value at the right end. Discount and
 * tip live here, above the forms of payment, as decisions taken before the
 * money changes hands — not wedged between the basket and its total.
 */

const ROW_SX = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  minHeight: 56,
  px: 2,
  borderTop: "1px solid",
  borderColor: "divider",
  textAlign: "left",
} as const;

const ROW_ACTIVE_SX = {
  ...ROW_SX,
  bgcolor: "semantic.hue.accent.surface",
} as const;

const TEXT_SX = { flex: 1, minWidth: 0 } as const;

const TITLE_SX = {
  fontSize: "0.9375rem",
  fontWeight: 600,
  lineHeight: 1.25,
} as const;

const HINT_SX = {
  fontSize: "0.71875rem",
  color: "text.secondary",
  lineHeight: 1.3,
} as const;

const VALUE_SX = {
  flex: "0 0 auto",
  textAlign: "right",
  fontSize: "0.9375rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.25,
} as const;

const VALUE_CODE_SX = {
  display: "block",
  fontSize: "0.6875rem",
  fontWeight: 400,
  color: "text.secondary",
} as const;

const CHEVRON_SX = { flex: "0 0 auto", color: "text.secondary" } as const;

export function AdjustmentRow({
  title,
  hint,
  value,
  valueCode,
  active = false,
  onClick,
}: AdjustmentRowProps) {
  const content = (
    <>
      <Box sx={TEXT_SX}>
        <Typography sx={TITLE_SX} noWrap>
          {title}
        </Typography>
        <Typography sx={HINT_SX} noWrap>
          {hint}
        </Typography>
      </Box>
      <Typography
        component="div"
        color={active ? "primary.main" : "text.primary"}
        sx={VALUE_SX}
      >
        {value}
        {valueCode && (
          <Box component="span" sx={VALUE_CODE_SX}>
            {valueCode}
          </Box>
        )}
      </Typography>
      {onClick && <ChevronRightIcon fontSize="small" sx={CHEVRON_SX} />}
    </>
  );

  if (!onClick) {
    return <Box sx={active ? ROW_ACTIVE_SX : ROW_SX}>{content}</Box>;
  }

  return (
    <ButtonBase onClick={onClick} sx={active ? ROW_ACTIVE_SX : ROW_SX}>
      {content}
    </ButtonBase>
  );
}
