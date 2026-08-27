"use client";

import { Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

interface SectionLabelProps {
  children: string;
  sx?: SxProps<Theme>;
}

/**
 * The small uppercase heading that opens a section — «Operación»,
 * «Suscripción», «Gastos de la tienda».
 *
 * The redesign uses it wherever a group of things needs naming without being
 * boxed: it replaces the card header that used to be the only way to say what
 * a list was, which is how screens ended up with a card inside a card on
 * phones. A label costs one line; a card costs a border, a padding and a
 * second background.
 *
 * Deliberately not an `h`-level of the type scale: it names a region, it does
 * not compete with the page title above it.
 */
export function SectionLabel({ children, sx }: SectionLabelProps) {
  return (
    <Typography
      component="h2"
      sx={{
        mb: 1.5,
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "text.disabled",
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}
