/**
 * Copy of the "totales desactualizados" state, in one place so the fixed
 * column, the mobile band, the page banner and the drawer alert never drift
 * from each other. See `.agents/designs/recalculo-cierres.md`.
 */
export const DESFASE_LABEL = "Totales desactualizados";

/** Why the figures are stale: the sales changed, or the old engine closed it. */
export type DesfaseMotivo = "ventas" | "motor-anterior";

export const DESFASE_EXPLICACION: Record<DesfaseMotivo, string> = {
  ventas:
    "Las ventas de este período cambiaron después del cierre. Sus cifras guardadas no reflejan las ventas actuales.",
  "motor-anterior":
    "Este cierre se hizo con una versión anterior y sus cifras guardadas aún no se han vuelto a derivar de las ventas.",
};

export const DESFASE_SOLO_SUPERADMIN =
  "Solo un superadministrador puede recalcularlas.";

export const DESFASE_TOOLTIP_RECALCULAR = `${DESFASE_LABEL} — recalcular`;

export const DESFASE_CARD_CUERPO =
  "Las cifras de abajo son las guardadas y no coinciden con las ventas actuales del período.";

export const DESFASE_DRAWER_CUERPO =
  "Las cifras de este cierre son las que se guardaron al cerrarlo, y no coinciden con las ventas actuales del período.";

export function desfaseMotivo(totalsComputedAt: unknown): DesfaseMotivo {
  return totalsComputedAt ? "ventas" : "motor-anterior";
}

/** `mixto`: some periods have edited sales, others were closed by the old engine. */
export function desfaseBannerCopy(
  count: number,
  motivo: DesfaseMotivo | "mixto",
): string {
  if (motivo === "motor-anterior") {
    return count === 1
      ? "Un cierre de esta página se hizo con una versión anterior y aún no se ha recalculado."
      : `${count} cierres de esta página se hicieron con una versión anterior y aún no se han recalculado.`;
  }
  if (motivo === "mixto") {
    return `${count} cierres de esta página tienen cifras desactualizadas: algunos por ventas que cambiaron después del cierre y otros por haberse cerrado con una versión anterior.`;
  }
  return count === 1
    ? "Un cierre de esta página tiene cifras desactualizadas: sus ventas cambiaron después de cerrarlo."
    : `${count} cierres de esta página tienen cifras desactualizadas: sus ventas cambiaron después de cerrarlos.`;
}
