"use client";

import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface PedidoFieldRowProps {
  /** Its own element, so a criterion can match its `textContent` exactly. */
  label: string;
  children: ReactNode;
  /** The total of the amount block: heavier, never a different hue. */
  emphasis?: boolean;
}

/**
 * A label on the left and a value on the right, which is the shape of every row
 * of the three blocks of the detail — amounts, contact and order data.
 *
 * The label is its own element and carries nothing else: the design's criteria
 * are written on the EXACT `textContent` of that element, because `Total parcial`
 * contains `Total` and a substring check over the page would be useless.
 *
 * Not interactive: these rows receive no events and have no pointer cursor, so
 * the touch floor does not apply to them.
 */
export function PedidoFieldRow({
  label,
  children,
  emphasis = false,
}: Readonly<PedidoFieldRowProps>) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      justifyContent="space-between"
      alignItems="baseline"
    >
      <Typography
        variant="body2"
        sx={{
          color: "semantic.text.secondary",
          flexShrink: 0,
          ...(emphasis && { fontWeight: 700, color: "semantic.text.primary" }),
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        component="div"
        sx={{
          color: "semantic.text.primary",
          textAlign: "right",
          overflowWrap: "anywhere",
          fontVariantNumeric: "tabular-nums",
          ...(emphasis && { fontWeight: 700 }),
        }}
      >
        {children}
      </Typography>
    </Stack>
  );
}

export default PedidoFieldRow;
