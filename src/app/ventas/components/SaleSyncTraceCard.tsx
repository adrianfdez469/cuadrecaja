import React from "react";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  Typography,
} from "@mui/material";
import { CloudDone } from "@mui/icons-material";
import { IVenta } from "@/schemas/venta";
import { formatDateTime } from "@/utils/formatters";
import { saleReportedAt } from "@/lib/venta/saleTime";
import { toSaleTimestamps } from "@/lib/venta/ventaTimestamps";
import { hasSyncTrace, saleSyncTraceReasons } from "@/lib/venta/saleSyncTrace";
import type { ISaleSyncTraceReason } from "@/constants/venta";

/**
 * Why a sale carries a sync trace, in the reader's language.
 *
 * Typed as a total Record over the closed vocabulary on purpose: adding a
 * fourth reason breaks the build here, at the exact spot where its sentence is
 * missing, instead of painting a blank line (E-035).
 *
 * The count of attempts is NEVER rendered, in any shape: the same column is
 * written with two different counting conventions depending on which POS path
 * wrote it, so a figure next to a label claiming what it counts would be
 * false half the time. ADR 0112.
 */
const SYNC_TRACE_REASON_TEXT: Record<ISaleSyncTraceReason, string> = {
  OFFLINE: "Se hizo sin conexión.",
  RETRIES: "Necesitó reintentos para llegar al servidor.",
};

interface SaleSyncTraceCardProps {
  venta: IVenta;
}

/**
 * The sync section of the sale detail dialog: the instant the device recorded
 * the sale next to the instant the server received it, plus the reason(s) this
 * sale is marked at all.
 *
 * It renders NOTHING for an ordinary sale — no card, no heading, no divider and
 * no empty container — which is as binding as showing it for a traced one. The
 * gate is the reason list itself, so the section can never exist with zero
 * reasons inside it.
 */
const SaleSyncTraceCard: React.FC<SaleSyncTraceCardProps> = ({ venta }) => {
  if (!hasSyncTrace(venta)) return null;

  const reasons = saleSyncTraceReasons(venta);

  // The adapter, not a loose `new Date(...)`: both instants arrive as ISO
  // strings at runtime even though the schema types them as Date.
  const timestamps = toSaleTimestamps(venta);
  const instants = [
    {
      label: "Registrada en el dispositivo",
      value: formatDateTime(saleReportedAt(timestamps)),
    },
    {
      // `createdAt` IS the moment the sale reached the server. Nothing is
      // derived from it and no gap between the two instants is computed.
      label: "Recibida por el servidor",
      value: formatDateTime(timestamps.createdAt),
    },
  ];

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <CloudDone />
          Sincronización
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {reasons.map((reason) => (
          <Typography key={reason} variant="body2" color="text.secondary">
            {SYNC_TRACE_REASON_TEXT[reason]}
          </Typography>
        ))}

        <Grid container spacing={2} sx={{ mt: 0 }}>
          {instants.map((instant) => (
            <Grid item xs={12} sm={6} key={instant.label}>
              <Box
                sx={{
                  py: 0.5,
                  px: 1,
                  borderRadius: 1,
                  bgcolor: "semantic.surface.sunken",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  {instant.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {instant.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default SaleSyncTraceCard;
