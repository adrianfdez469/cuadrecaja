"use client";

import { Box, Skeleton, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { shape } from "@/theme/tokens";
import { formatDate } from "@/utils/formatters";

export interface NegocioStats {
  tiendas: { actual: number; limite: number; porcentaje: number };
  usuarios: { actual: number; limite: number; porcentaje: number };
  productos: { actual: number; limite: number; porcentaje: number };
  fechaVencimiento: Date;
  diasRestantes: number;
}

interface PlanLimitsStripProps {
  stats?: NegocioStats;
  loading: boolean;
}

/** `-1` is the API's way of saying the plan does not cap this. */
const UNLIMITED = -1;

function limitLabel(limite: number): string {
  return limite === UNLIMITED ? "∞" : String(limite);
}

function Figure({ children }: { children: ReactNode }) {
  return (
    <Box
      component="strong"
      sx={{
        fontWeight: 700,
        color: "text.primary",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </Box>
  );
}

/**
 * What the plan allows, against what is used.
 *
 * A footer under the subscription panel rather than four chips under the page
 * title. As chips they were the first thing on the screen after the greeting,
 * outlined in the accent so all four read as actions, and each carried a
 * `color` prop that the `sx` below it overrode — so the traffic-light logic
 * computing error/warning/success never reached the screen at all. They are
 * reference figures: they belong beside the subscription they describe, in
 * ink, and the one that can actually run out — the expiry — sits apart at the
 * end of the line.
 */
export function PlanLimitsStrip({ stats, loading }: PlanLimitsStripProps) {
  if (loading || !stats) {
    return (
      <Box sx={{ px: 3, py: 1.75 }}>
        <Skeleton variant="text" width={420} height={20} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: { xs: 1, md: 3 },
        px: { xs: 2, md: 3 },
        py: 1.75,
        borderTop: "1px solid",
        borderColor: "semantic.surface.border",
        borderRadius: `0 0 ${shape.radius.md}px ${shape.radius.md}px`,
        fontSize: "0.8125rem",
        color: "text.secondary",
      }}
    >
      <Typography sx={{ fontSize: "inherit", color: "inherit" }}>
        Productos <Figure>{stats.productos.actual}</Figure> /{" "}
        {limitLabel(stats.productos.limite)}
      </Typography>
      <Typography sx={{ fontSize: "inherit", color: "inherit" }}>
        Usuarios <Figure>{stats.usuarios.actual}</Figure> /{" "}
        {limitLabel(stats.usuarios.limite)}
      </Typography>
      <Typography sx={{ fontSize: "inherit", color: "inherit" }}>
        Tiendas <Figure>{stats.tiendas.actual}</Figure> /{" "}
        {limitLabel(stats.tiendas.limite)}
        {stats.tiendas.limite !== UNLIMITED &&
          ` · ${stats.tiendas.porcentaje}%`}
      </Typography>
      <Typography
        sx={{
          fontSize: "inherit",
          color: "inherit",
          ml: { xs: 0, md: "auto" },
          // The only figure here that can turn into a problem, so it is the
          // only one allowed a hue.
          ...(stats.diasRestantes <= 7 && {
            color:
              stats.diasRestantes <= 0
                ? "semantic.hue.negative.main"
                : "semantic.hue.caution.main",
          }),
        }}
      >
        Vence el <Figure>{formatDate(stats.fechaVencimiento)}</Figure> ·{" "}
        <Figure>{stats.diasRestantes}</Figure> días restantes
      </Typography>
    </Box>
  );
}
