"use client";

import { Typography } from "@mui/material";
import { StatusPill } from "@/components/StatusPill";

/**
 * The exception speaks, the norm keeps quiet — shared between the desktop
 * table and the mobile card list so the two views never drift apart on what
 * counts as a shortage, a near expiry, or a loss.
 */
export function getStockPill(existencia: number) {
  if (existencia <= 0) return <StatusPill label="Sin stock" hue="negative" />;
  if (existencia <= 5) return <StatusPill label="Bajo" hue="caution" />;
  return null;
}

export function stockTone(existencia: number) {
  if (existencia <= 0) return "semantic.hue.negative.main";
  if (existencia <= 5) return "semantic.hue.caution.main";
  return undefined;
}

export function getExpiryPill(fechaVencimiento: string | null | undefined) {
  if (!fechaVencimiento) return null;
  const dias = Math.ceil(
    (new Date(fechaVencimiento).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (dias <= 0) return <StatusPill label="Vencido" hue="negative" />;
  if (dias <= 7) return <StatusPill label={`${dias} días`} hue="negative" />;
  if (dias <= 30) return <StatusPill label={`${dias} días`} hue="caution" />;
  // Far off is not a warning: it reads as plain text like any other date.
  return (
    <Typography variant="body2" color="text.secondary">
      {`${dias} días`}
    </Typography>
  );
}

/**
 * A healthy or unremarkable margin is the norm and stays plain; only a loss
 * (selling under cost) is the exception worth flagging in red.
 */
export function rentabilidadColor(rentabilidad: string) {
  return parseFloat(rentabilidad) < 0 ? "error.main" : "text.secondary";
}
