"use client";

import { Stack, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { LoadingState } from "@/components/LoadingState";
import { StatusPill } from "@/components/StatusPill";
import { resolveQabSyncState } from "@/components/qab/qabSyncState";
import type { INegocioQabSettingsItem } from "@/schemas/qabNegocio";
import { formatDate } from "@/utils/formatters";

export type QabRowSummaryProps = Readonly<{
  settings?: INegocioQabSettingsItem;
  loading: boolean;
  /** The QAB block could not be loaded: the row says so instead of guessing. */
  unavailable: boolean;
}>;

const LABEL_SYNCING = "Sincroniza";
const LABEL_MISSING_CREDENTIAL = "Falta la credencial";
const LABEL_OFF = "No sincroniza";

/**
 * The per-row summary: the pill of the EFFECT plus the line that backs it.
 *
 * It reports the effect, never the intention: a business with the switch on and
 * no credential does not sync, and saying "online store enabled" there would be
 * a lie the cron does not honour.
 *
 * Declares no breakpoint of its own: the only threshold in this subtree is the
 * `down("md")` the screen already had.
 */
export function QabRowSummary({ settings, loading, unavailable }: QabRowSummaryProps) {
  if (unavailable) {
    return (
      <Typography variant="body2" sx={{ color: "semantic.text.disabled" }}>
        Sin datos
      </Typography>
    );
  }

  if (loading || !settings) {
    return <LoadingState variant="text" count={1} />;
  }

  const state = resolveQabSyncState(settings);
  const savedOn = settings.qabTokenActualizadoAt
    ? formatDate(settings.qabTokenActualizadoAt)
    : null;

  if (state === "SYNCING") {
    return (
      <Summary
        pill={
          <StatusPill
            label={LABEL_SYNCING}
            sx={{
              bgcolor: "semantic.sync.online.surface",
              color: "semantic.sync.online.main",
            }}
          />
        }
        detail={savedOn ? `Credencial guardada el ${savedOn}` : "Credencial guardada"}
      />
    );
  }

  if (state === "MISSING_CREDENTIAL") {
    return (
      <Summary
        pill={
          <StatusPill
            label={LABEL_MISSING_CREDENTIAL}
            icon={<WarningAmberIcon />}
            sx={{
              bgcolor: "semantic.sync.offline.surface",
              color: "semantic.sync.offline.main",
            }}
          />
        }
        detail="Tienda online activa · este negocio no entra en la sincronización"
      />
    );
  }

  return (
    <Summary
      pill={
        <StatusPill
          label={LABEL_OFF}
          sx={{
            bgcolor: "semantic.hue.neutral.surface",
            color: "semantic.hue.neutral.main",
          }}
        />
      }
      detail={
        savedOn
          ? `Tienda online apagada · Credencial ${savedOn}`
          : "Tienda online apagada · Sin credencial"
      }
    />
  );
}

function Summary({
  pill,
  detail,
}: Readonly<{ pill: React.ReactNode; detail: string }>) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      flexWrap="wrap"
      useFlexGap
      sx={{ rowGap: 0.5 }}
    >
      {pill}
      {/* Never truncated: a state cut short is worse than a state on two lines. */}
      <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
        {detail}
      </Typography>
    </Stack>
  );
}

export default QabRowSummary;
