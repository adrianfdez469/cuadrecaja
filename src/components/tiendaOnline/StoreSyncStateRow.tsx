"use client";

import { Box, Button, Stack, Typography } from "@mui/material";

import { StatusPill } from "@/components/StatusPill";
import type { PillHue } from "@/components/StatusPill";
import { QAB_OUTBOX_MAX_ATTEMPTS } from "@/constants/qab";
import { SUPPORT_EMAIL } from "@/constants/support";
import type {
  IQabStoreSyncCode,
  IQabStoreSyncState,
} from "@/schemas/tiendaOnline";
import { shape, touch } from "@/theme/tokens";

export interface StoreSyncStateRowProps {
  syncState: IQabStoreSyncState;
  /** Opens the schedule card, for the one code the merchant can act on. */
  onReviewSchedule: () => void;
}

const STATE_PRESENTATION: Record<
  string,
  { label: string; hue: PillHue; tail: string }
> = {
  PENDING: {
    label: "Enviando",
    hue: "info",
    tail: "Los últimos cambios se están enviando a tu tienda online.",
  },
  FAILED: { label: "Falló el envío", hue: "caution", tail: "" },
  BLOCKED: { label: "No se pudo enviar", hue: "negative", tail: "" },
};

/**
 * The sentence of each code. A value with no row of its own falls into the last
 * one: the raw code NEVER reaches the screen (ADR 0034), and neither does
 * `OutboxEvento.ultimoError`.
 */
const CODE_SENTENCES: Partial<Record<IQabStoreSyncCode, string>> = {
  STORE_OPENING_HOURS_INVALID:
    "El horario que se envió no lo acepta la tienda online.",
  STORE_TIMEZONE_INVALID:
    "La tienda online no reconoce la zona horaria de este local.",
  BUSINESS_MISMATCH:
    "El envío se rechazó por un problema de credenciales del negocio.",
};

const FALLBACK_SENTENCE =
  "El último envío a la tienda online no se pudo completar.";

/**
 * The sync state of one local, as a row of the publication card.
 *
 * It says whether OUR send went out — never what the online store is showing.
 * A `SYNCED` does not promise the local is visible (the panel may have closed
 * it) and a `BLOCKED` does not mean the store is down. Those two facts are kept
 * apart on purpose.
 */
export function StoreSyncStateRow({
  syncState,
  onReviewSchedule,
}: Readonly<StoreSyncStateRowProps>) {
  // Everything being up to date is not news and does not earn a permanent row.
  if (syncState.state === "SYNCED") return null;

  const presentation = STATE_PRESENTATION[syncState.state];
  if (presentation === undefined) return null;

  const sentence =
    syncState.code === null
      ? ""
      : (CODE_SENTENCES[syncState.code] ?? FALLBACK_SENTENCE);

  const attemptsLine =
    syncState.state === "FAILED"
      ? `Reintento ${syncState.attempts} de ${QAB_OUTBOX_MAX_ATTEMPTS}.`
      : syncState.state === "BLOCKED"
        ? `Se agotaron los ${QAB_OUTBOX_MAX_ATTEMPTS} intentos.`
        : "";

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: `${shape.radius.md}px`,
        bgcolor: `semantic.hue.${presentation.hue}.surface`,
        color: `semantic.hue.${presentation.hue}.main`,
      }}
    >
      <Stack spacing={1}>
        <Box>
          <StatusPill label={presentation.label} hue={presentation.hue} />
        </Box>
        {presentation.tail.length > 0 && (
          <Typography variant="body2">{presentation.tail}</Typography>
        )}
        {sentence.length > 0 && (
          <Typography variant="body2">{sentence}</Typography>
        )}
        {attemptsLine.length > 0 && (
          <Typography variant="body2">{attemptsLine}</Typography>
        )}

        {syncState.code === "STORE_OPENING_HOURS_INVALID" && (
          <Box>
            <Button
              variant="text"
              color="inherit"
              onClick={onReviewSchedule}
              sx={{ minHeight: touch.min }}
            >
              Revisar el horario
            </Button>
          </Box>
        )}

        {syncState.code === "STORE_TIMEZONE_INVALID" && (
          <Typography variant="body2">
            {`Esta zona la corrige el equipo de la tienda online. Escríbeles a ${SUPPORT_EMAIL}.`}
          </Typography>
        )}

        {syncState.code === "BUSINESS_MISMATCH" && (
          <Typography variant="body2">
            {`No se arregla en esta pantalla. Escribe a soporte: ${SUPPORT_EMAIL}.`}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export default StoreSyncStateRow;
