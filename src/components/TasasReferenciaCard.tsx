"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { OpenInNew, Refresh } from "@mui/icons-material";
import { ELTOQUE_LOGO_SRC, ELTOQUE_SOURCE_URL } from "@/constants/eltoque";
import { getTasasReferencia } from "@/services/tasaReferenciaService";
import type {
  ITasaReferencia,
  ITasasReferenciaResponse,
} from "@/schemas/tasaReferencia";

interface TasasReferenciaCardProps {
  /** Tasas vigentes del negocio, para contrastar contra la referencia. */
  vigentes: Record<string, number>;
  /** Códigos de moneda habilitados y activos en el negocio (sin CUP). */
  monedasHabilitadas: string[];
  onAplicar: (tasa: ITasaReferencia, vigente?: number) => Promise<void>;
  onAplicarTodas: (tasas: ITasaReferencia[]) => Promise<void>;
}

const fmtActualizado = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// La TRMI se mueve en minutos, así que lo que importa no es la hora exacta de la consulta
// sino cuánto hace que se hizo. La hora exacta queda en el tooltip.
const fmtEdad = (iso: string) => {
  const minutos = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (minutos < 1) return "hace instantes";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
};

export function TasasReferenciaCard({
  vigentes,
  monedasHabilitadas,
  onAplicar,
  onAplicarTodas,
}: TasasReferenciaCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [data, setData] = useState<ITasasReferenciaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  /**
   * @param force refresco pedido por el usuario: pide un dato más nuevo que el TTL normal
   *   y mantiene el panel visible (solo gira el icono) en vez de volver al skeleton.
   */
  const load = useCallback(async (force = false) => {
    if (force) setRefrescando(true);
    else setLoading(true);
    setError(false);
    try {
      setData(await getTasasReferencia(force));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Solo monedas que el negocio tiene habilitadas: no tiene sentido ofrecer aplicar
  // una tasa para una moneda que no usa.
  const filas = useMemo(
    () =>
      (data?.tasas ?? []).filter((t) =>
        monedasHabilitadas.includes(t.monedaCode),
      ),
    [data, monedasHabilitadas],
  );

  const desviadas = useMemo(
    () => filas.filter((f) => vigentes[f.monedaCode] !== f.tasa),
    [filas, vigentes],
  );

  const handleAplicar = async (tasa: ITasaReferencia) => {
    setAplicando(tasa.monedaCode);
    try {
      await onAplicar(tasa, vigentes[tasa.monedaCode]);
    } finally {
      setAplicando(null);
    }
  };

  const handleAplicarTodas = async () => {
    setAplicando("__todas__");
    try {
      await onAplicarTodas(desviadas);
    } finally {
      setAplicando(null);
    }
  };

  // El logo se mantiene en todos los estados para que el panel conserve su identidad
  // mientras carga o cuando no hay datos que mostrar.
  const logo = (
    <Box
      component="img"
      src={ELTOQUE_LOGO_SRC}
      alt="elTOQUE"
      sx={{ width: 28, height: 28, flexShrink: 0, display: "block" }}
    />
  );

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
          {logo}
          <Skeleton variant="text" width={190} height={28} />
        </Stack>
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={32} />
          ))}
        </Stack>
      </Paper>
    );
  }

  if (error || (data && !data.disponible && data.motivo === "ERROR_UPSTREAM")) {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => load(true)}>
            Reintentar
          </Button>
        }
      >
        No se pudieron obtener las tasas de referencia de elTOQUE.
      </Alert>
    );
  }

  // Estado esperado mientras no haya token configurado: informativo, no un error.
  if (data && !data.disponible && data.motivo === "NO_CONFIGURADO") {
    return (
      <Alert severity="info" icon={logo} sx={{ mb: 2 }}>
        Integración con elTOQUE no configurada. Al habilitarla podrás ver aquí
        las tasas de referencia del mercado informal y aplicarlas con un clic.
      </Alert>
    );
  }

  // Sin coincidencias con las monedas del negocio no hay nada útil que mostrar.
  if (filas.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        mb={1.5}
      >
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          {logo}
          <Typography variant="subtitle2" fontWeight="bold">
            Referencia elTOQUE
          </Typography>
          {data?.actualizadoEn && (
            <Tooltip
              title={`Consultado a elTOQUE el ${fmtActualizado(data.actualizadoEn)}`}
            >
              <Typography variant="caption" color="text.secondary">
                · {fmtEdad(data.actualizadoEn)}
              </Typography>
            </Tooltip>
          )}
          {data?.stale && (
            <Tooltip title="No se pudo contactar a elTOQUE; se muestra el último dato conocido.">
              <Chip
                label="Dato desactualizado"
                color="warning"
                size="small"
                variant="outlined"
              />
            </Tooltip>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" gap={0.5}>
          <Tooltip title="Actualizar">
            <IconButton
              size="small"
              onClick={() => load(true)}
              disabled={refrescando}
            >
              {refrescando ? (
                <CircularProgress size={16} />
              ) : (
                <Refresh fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          {desviadas.length > 1 && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleAplicarTodas}
              disabled={aplicando !== null}
            >
              {aplicando === "__todas__" ? (
                <CircularProgress size={16} />
              ) : (
                "Aplicar todas"
              )}
            </Button>
          )}
        </Stack>
      </Stack>

      <Divider sx={{ mb: 1.5 }} />

      <Stack spacing={isMobile ? 1.5 : 1}>
        {filas.map((fila) => {
          const vigente = vigentes[fila.monedaCode];
          const diff = vigente ? fila.tasa - vigente : null;
          const pct = vigente ? (diff / vigente) * 100 : null;
          const igual = vigente === fila.tasa;

          const detalle =
            vigente === undefined ? (
              <Typography variant="caption" color="text.secondary">
                sin tasa registrada
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                tu tasa: {vigente}
                {!igual && (
                  <Box
                    component="span"
                    sx={{
                      ml: 0.75,
                      fontWeight: "bold",
                      color: diff > 0 ? "success.main" : "error.main",
                    }}
                  >
                    ({diff > 0 ? "+" : ""}
                    {Number(diff.toFixed(2))} · {diff > 0 ? "+" : ""}
                    {pct.toFixed(1)}%)
                  </Box>
                )}
                {igual && (
                  <Box component="span" sx={{ ml: 0.75 }}>
                    (=)
                  </Box>
                )}
              </Typography>
            );

          const boton = (
            <Button
              size="small"
              variant="text"
              onClick={() => handleAplicar(fila)}
              disabled={igual || aplicando !== null}
            >
              {aplicando === fila.monedaCode ? (
                <CircularProgress size={16} />
              ) : (
                "Aplicar"
              )}
            </Button>
          );

          if (isMobile) {
            return (
              <Box key={fila.monedaCode}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Chip label={fila.monedaCode} size="small" />
                    <Typography variant="body2" fontWeight="bold">
                      {fila.tasa} CUP
                    </Typography>
                  </Stack>
                  {boton}
                </Stack>
                {detalle}
              </Box>
            );
          }

          return (
            <Stack
              key={fila.monedaCode}
              direction="row"
              alignItems="center"
              gap={1.5}
              flexWrap="wrap"
            >
              <Chip
                label={fila.monedaCode}
                size="small"
                sx={{ minWidth: 56 }}
              />
              <Typography
                variant="body2"
                fontWeight="bold"
                sx={{ minWidth: 96 }}
              >
                {fila.tasa} CUP
              </Typography>
              <Box sx={{ flexGrow: 1 }}>{detalle}</Box>
              {boton}
            </Stack>
          );
        })}
      </Stack>

      {/* Atribución obligatoria por los términos de uso de la API */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1.5 }}
      >
        Valores referenciales del mercado informal. Fuente:{" "}
        <Link
          href={ELTOQUE_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
        >
          elTOQUE
          <OpenInNew sx={{ fontSize: 12 }} />
        </Link>
      </Typography>
    </Paper>
  );
}
