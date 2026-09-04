"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ContentCopy } from "@mui/icons-material";

import { LoadingState } from "@/components/LoadingState";
import { StatusPill } from "@/components/StatusPill";
import type { PillHue } from "@/components/StatusPill";
import { QAB_PUBLIC_STORE_DOMAIN } from "@/constants/qab";
import { TIENDA_ONLINE_UI } from "@/constants/tiendaOnline";
import {
  TiendaOnlineSlugUpstreamError,
  getTiendaOnlineSlugForecast,
} from "@/services/tiendaOnlineService";
import type { ITiendaOnlineSlugForecast } from "@/schemas/tiendaOnline";
import { shape, touch } from "@/theme/tokens";

export interface SlugPreviewFieldProps {
  /** The candidate the merchant typed. `""` means «use the local's name». */
  slug: string;
  localNombre: string;
  tiendaId: string;
  isMobile: boolean;
  online: boolean;
  onSlugChange: (next: string) => void;
}

const SLUG_PREFIX = `${QAB_PUBLIC_STORE_DOMAIN}/`;

/** The six documented `reason` values, and how each one is presented. */
const REASON_PRESENTATION: Record<string, { label: string; hue: PillHue; copy: string }> =
  {
    free: {
      label: "Libre",
      hue: "positive",
      copy: "Nadie la tiene. Si publicas ahora, esta es tu dirección.",
    },
    own: {
      label: "Ya es tuya",
      hue: "positive",
      copy: "Esta dirección ya es de tu tienda. Publicar no la cambia.",
    },
    taken: {
      label: "Ocupada",
      hue: "caution",
      copy: "Ya la tiene otra tienda. Si publicas ahora, te queda la de arriba.",
    },
    reserved: {
      label: "Reservada",
      hue: "caution",
      copy: "Es una palabra que la tienda online se reserva para sí misma. Si publicas ahora, te queda la de arriba.",
    },
    retired: {
      label: "Retirada",
      hue: "caution",
      copy: "Estuvo en uso y ya no vuelve a estar disponible para nadie. Si publicas ahora, te queda la de arriba.",
    },
    invalid: {
      label: "No sirve",
      hue: "negative",
      copy: "No se puede convertir en una dirección web, o pasa de 80 caracteres. Prueba con otra.",
    },
  };

/** A seventh `reason` must not break the screen (ADR 0033, rule 3). */
const UNCLASSIFIED = {
  label: "Sin clasificar",
  hue: "neutral" as PillHue,
  copy: "Si publicas ahora, esta es la dirección que te queda.",
};

type ForecastState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; forecast: ITiendaOnlineSlugForecast }
  | { kind: "upstream"; retryable: boolean }
  | { kind: "offline" };

/**
 * The slug field and its forecast.
 *
 * A FORECAST, never a reservation: `reserving` is always false by contract, and
 * between the query and the publish somebody else can take the value. Its
 * failure blocks nothing — not the publish switch, not the save (ADR 0033).
 */
export function SlugPreviewField({
  slug,
  localNombre,
  tiendaId,
  isMobile,
  online,
  onSlugChange,
}: Readonly<SlugPreviewFieldProps>) {
  const [state, setState] = useState<ForecastState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);

  const candidate = slug.trim();

  const load = useCallback(async () => {
    if (!online) {
      setState({ kind: "offline" });
      return;
    }
    const id = requestId.current + 1;
    requestId.current = id;
    setState({ kind: "loading" });
    try {
      const forecast = await getTiendaOnlineSlugForecast(
        // With the field empty the local's name is what QAB derives from, so
        // there is ALWAYS a visible forecast — the default path (touch nothing
        // and publish) is informed instead of blind.
        candidate.length > 0
          ? { slug: candidate, tiendaId }
          : { name: localNombre, tiendaId },
      );
      if (requestId.current !== id) return;
      setState({ kind: "ok", forecast });
    } catch (error) {
      if (requestId.current !== id) return;
      setState({
        kind: "upstream",
        retryable:
          error instanceof TiendaOnlineSlugUpstreamError
            ? error.retryable
            : true,
      });
    }
  }, [candidate, localNombre, online, tiendaId]);

  useEffect(() => {
    // On mount, and then only after the keystrokes stop: the route talks to a
    // third party, so never once per character.
    const timer = window.setTimeout(load, TIENDA_ONLINE_UI.slugForecastDebounceMs);
    return () => window.clearTimeout(timer);
  }, [load, attempt]);

  const copyUrl = (url: string) => {
    void navigator.clipboard?.writeText(url);
  };

  return (
    <Stack spacing={1.5}>
      {isMobile && (
        <Typography variant="caption" sx={{ color: "semantic.text.secondary" }}>
          {SLUG_PREFIX}
        </Typography>
      )}
      <TextField
        label="Dirección que quieres"
        value={slug}
        onChange={(event) => onSlugChange(event.target.value)}
        helperText="Solo minúsculas, números y guiones. Si lo dejas vacío, se arma con el nombre del local."
        fullWidth
        slotProps={
          isMobile
            ? undefined
            : {
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {SLUG_PREFIX}
                    </InputAdornment>
                  ),
                },
              }
        }
      />

      <Box
        sx={{
          p: 1.5,
          borderRadius: `${shape.radius.md}px`,
          bgcolor: "semantic.surface.sunken",
        }}
      >
        {state.kind === "loading" && <LoadingState variant="text" count={1} />}

        {state.kind === "offline" && (
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            No se puede consultar la dirección sin conexión.
          </Typography>
        )}

        {state.kind === "upstream" && (
          <Stack spacing={1}>
            <Typography
              variant="body2"
              sx={{ color: "semantic.hue.caution.main" }}
            >
              {state.retryable
                ? "No se pudo consultar la dirección ahora mismo. Puedes publicar igual: la dirección se decide al publicar."
                : "La consulta de direcciones no está disponible para tu negocio. Puedes publicar igual: la dirección se decide al publicar."}
            </Typography>
            {state.retryable && (
              <Box>
                <Button
                  variant="text"
                  onClick={() => setAttempt((current) => current + 1)}
                  sx={{ minHeight: touch.min }}
                >
                  Volver a consultar
                </Button>
              </Box>
            )}
          </Stack>
        )}

        {state.kind === "ok" && (
          <Stack spacing={1}>
            {(() => {
              const presentation =
                REASON_PRESENTATION[state.forecast.reason] ?? UNCLASSIFIED;
              return (
                <>
                  <Box>
                    <StatusPill
                      label={presentation.label}
                      hue={presentation.hue}
                    />
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 600, wordBreak: "break-all" }}
                    >
                      {/* `url` exactly as the online store returns it: never a
                          URL concatenated from the candidate, which is the
                          «local calculation» acceptance criterion 3 forbids. */}
                      {state.forecast.url}
                    </Typography>
                    <IconButton
                      aria-label="Copiar la dirección"
                      onClick={() => copyUrl(state.forecast.url)}
                      sx={{ width: touch.min, height: touch.min }}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ color: "semantic.text.secondary" }}
                  >
                    {presentation.copy}
                  </Typography>
                </>
              );
            })()}
          </Stack>
        )}
      </Box>

      <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
        Es un pronóstico, no una reserva: si otro publica esa dirección antes que
        tú, te va a tocar la siguiente libre.
      </Typography>
    </Stack>
  );
}

export default SlugPreviewField;
