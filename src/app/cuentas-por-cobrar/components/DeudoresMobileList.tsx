"use client";

import { Box, ButtonBase, Card, Stack, Typography } from "@mui/material";
import { StatusPill } from "@/components/StatusPill";
import { formatDate, formatMontoEnMoneda } from "@/utils/formatters";
import {
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
} from "@/constants/cuentasPorCobrar";
import { formatAntiguedadDias } from "@/lib/cuentasPorCobrar/panel";
import { touch } from "@/theme";
import type { IDeudorRow } from "@/schemas/cuentasPorCobrarPanel";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

interface DeudoresMobileListProps {
  deudores: IDeudorRow[];
  monedaBase: string;
  onVerDetalle: (clienteId: string) => void;
}

function Linea({
  etiqueta,
  children,
}: Readonly<{ etiqueta: string; children: React.ReactNode }>) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
        {etiqueta}
      </Typography>
      {children}
    </Stack>
  );
}

/**
 * The debtor list under 600 px: one card per debtor, and NO `<table>` in the DOM at this width.
 * A table does not compress, it forks — the standing pattern of `GestionInventarioPage`.
 *
 * The WHOLE card is the touch target, so there is no second destination nested inside it.
 */
export function DeudoresMobileList({
  deudores,
  monedaBase,
  onVerDetalle,
}: DeudoresMobileListProps) {
  return (
    <Stack spacing={2} sx={{ p: 2 }} className={DOM.lista}>
      {deudores.map((deudor) => {
        const conDeuda = deudor.estado === "CON_DEUDA";
        return (
          <Card key={deudor.clienteId}>
            <ButtonBase
              className={DOM.fila}
              onClick={() => onVerDetalle(deudor.clienteId)}
              sx={{
                width: "100%",
                minHeight: touch.rowLarge,
                display: "block",
                textAlign: "left",
                p: 2,
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, whiteSpace: "normal" }}
                >
                  {deudor.clienteNombre}
                </Typography>
                <Box sx={{ flexShrink: 0 }}>
                  <StatusPill
                    label={conDeuda ? COPY.estadoConDeuda : COPY.estadoSaldada}
                    hue={conDeuda ? "caution" : "positive"}
                  />
                </Box>
              </Stack>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                sx={{ mt: 1 }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary" }}
                >
                  {COPY.etiquetaSaldo}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontVariantNumeric: "tabular-nums",
                    color: conDeuda
                      ? "semantic.money.neutral.main"
                      : "semantic.text.disabled",
                  }}
                >
                  {formatMontoEnMoneda(deudor.saldo, monedaBase)}
                </Typography>
              </Stack>

              <Stack
                spacing={0.75}
                sx={{
                  mt: 1.5,
                  pt: 1.5,
                  borderTop: 1,
                  borderColor: "semantic.surface.border",
                }}
              >
                <Linea etiqueta={COPY.etiquetaAntiguedad}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      sx={{ color: "semantic.text.primary" }}
                    >
                      {deudor.antiguedadDias === null
                        ? COPY.sinDato
                        : formatAntiguedadDias(deudor.antiguedadDias)}
                    </Typography>
                    {deudor.antiguedadBucket && (
                      <StatusPill
                        label={`${deudor.antiguedadBucket} días`}
                        hue="neutral"
                      />
                    )}
                  </Stack>
                </Linea>

                <Linea etiqueta={COPY.etiquetaUltimoAbono}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: deudor.ultimoAbonoAt
                        ? "semantic.text.primary"
                        : "semantic.text.disabled",
                    }}
                  >
                    {deudor.ultimoAbonoAt
                      ? formatDate(new Date(deudor.ultimoAbonoAt))
                      : COPY.sinDato}
                  </Typography>
                </Linea>

                <Linea etiqueta={COPY.etiquetaCuentas}>
                  <Typography variant="body2">
                    {deudor.cuentasAbiertas}
                  </Typography>
                </Linea>
              </Stack>
            </ButtonBase>
          </Card>
        );
      })}
    </Stack>
  );
}
