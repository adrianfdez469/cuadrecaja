"use client";

import { Box, Stack, Typography } from "@mui/material";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import StorefrontIcon from "@mui/icons-material/Storefront";

import { StatusPill } from "@/components/StatusPill";
import type { PillHue } from "@/components/StatusPill";
import {
  productoPublicacionPresentation,
  visibilidadParcialLine,
} from "@/components/tiendaOnline/productoPublicacionPresentation";
import type { IProductoPublicacionIcon } from "@/components/tiendaOnline/productoPublicacionPresentation";
import type { ITiendaOnlineProducto } from "@/schemas/tiendaOnline";
import { shape } from "@/theme/tokens";

/**
 * The two visual pieces of a product's state, shared by the phone list and the
 * table so the same fact never gets two shapes.
 *
 * The decision of WHICH pill, WHICH hue and WHICH sentence is not here: it is in
 * `productoPublicacionPresentation.ts`, a `.ts` the suite can import (E-015).
 */

/** The icon name the pure module returns, turned into an element. */
function pillIcon(icon: IProductoPublicacionIcon) {
  if (icon === "storefront") return <StorefrontIcon />;
  if (icon === "linkOff") return <LinkOffIcon />;
  return undefined;
}

export interface ProductoEstadoPillProps {
  producto: ITiendaOnlineProducto;
}

/** The pill, and under it the partial-visibility line when there is one. */
export function ProductoEstadoPill({
  producto,
}: Readonly<ProductoEstadoPillProps>) {
  const presentation = productoPublicacionPresentation(producto);
  const parcial = visibilidadParcialLine(producto);

  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <StatusPill
        label={presentation.label}
        hue={presentation.hue}
        icon={pillIcon(presentation.icon)}
      />
      {parcial !== null && (
        <Typography
          variant="body2"
          sx={{ color: "semantic.text.secondary" }}
        >
          {parcial}
        </Typography>
      )}
    </Stack>
  );
}

export interface ProductoRazonBlockProps {
  producto: ITiendaOnlineProducto;
}

/**
 * The tinted reason block. `null` for the states that need none, which is what
 * keeps a row that has nothing to explain from carrying an empty box.
 *
 * It is never inside the Estado column and never inside a tooltip: sixty
 * characters in a 150 px cell break into five lines, and on a touch screen a
 * tooltip is text that does not exist.
 */
export function ProductoRazonBlock({
  producto,
}: Readonly<ProductoRazonBlockProps>) {
  const presentation = productoPublicacionPresentation(producto);
  if (presentation.reason.length === 0) return null;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: `${shape.radius.md}px`,
        bgcolor: `semantic.hue.${presentation.hue as PillHue}.surface`,
        color: `semantic.hue.${presentation.hue as PillHue}.main`,
      }}
    >
      <Typography variant="body2">{presentation.reason}</Typography>
    </Box>
  );
}
