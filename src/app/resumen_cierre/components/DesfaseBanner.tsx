"use client";

import { Alert } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { ISummaryCierre } from "@/schemas/cierre";
import { desfaseBannerCopy, desfaseMotivo } from "./desfaseCopy";

interface Props {
  cierres: ISummaryCierre["cierres"];
  sx?: SxProps<Theme>;
}

/**
 * Page-level notice: "there is something to look at" on this page. The row
 * slot answers "which one". No action here — recalculation is per period.
 */
export default function DesfaseBanner({ cierres, sx }: Readonly<Props>) {
  const stale = cierres.filter((c) => c.totalesDesactualizados);
  if (stale.length === 0) return null;

  // Name the actual reason: edited sales, the previous engine, or both.
  const motivos = new Set(stale.map((c) => desfaseMotivo(c.totalsComputedAt)));
  const motivo =
    motivos.size > 1 ? "mixto" : (motivos.values().next().value ?? "ventas");

  return (
    <Alert severity="warning" sx={sx}>
      {desfaseBannerCopy(stale.length, motivo)}
    </Alert>
  );
}
