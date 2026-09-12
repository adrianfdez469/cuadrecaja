"use client";

import { useState } from "react";
import { Box, Button, Card, IconButton, Stack, Typography } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import HeartBrokenIcon from "@mui/icons-material/HeartBroken";
import { StatusPill } from "@/components/StatusPill";
import { ActionSheet } from "@/components/ActionSheet";
import { formatDate, formatMontoEnMoneda } from "@/utils/formatters";
import {
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
} from "@/constants/cuentasPorCobrar";
import { formatAntiguedadDias } from "@/lib/cuentasPorCobrar/panel";
import type { IDeudorDetalleResponse } from "@/schemas/cuentasPorCobrarPanel";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

type ICuentaDetalle = IDeudorDetalleResponse["cuentas"][number];

interface CuentaCardProps {
  cuenta: ICuentaDetalle;
  monedaBase: string;
  isMobile: boolean;
  puedeCobrar: boolean;
  puedePerdonar: boolean;
  onCobrar: (cuenta: ICuentaDetalle) => void;
  onPerdonar: (cuenta: ICuentaDetalle) => void;
  onVerVenta: (cuenta: ICuentaDetalle) => void;
}

/**
 * One credit sale, with everything that can be done about it.
 *
 * HIDDEN BY PERMISSION, DISABLED BY STATE. A missing permission is not something the user can
 * solve from this screen; a closed till is. Offering a button that can never be pressed is
 * noise; offering a disabled one with its reason is an instruction.
 */
export function CuentaCard({
  cuenta,
  monedaBase,
  isMobile,
  puedeCobrar,
  puedePerdonar,
  onCobrar,
  onPerdonar,
  onVerVenta,
}: Readonly<CuentaCardProps>) {
  const [sheetAbierto, setSheetAbierto] = useState(false);

  const saldada = cuenta.settledAt !== null;
  const sinCaja = cuenta.cierrePeriodoAbiertoId === null;
  const ventaDisponible = cuenta.venta !== null;
  const tituloVenta = `${COPY.cuentaVentaDel} ${formatDate(new Date(cuenta.fechaVenta))}`;

  const mostrarCobrar = puedeCobrar && !saldada;
  const mostrarPerdonar = puedePerdonar && !saldada;

  const verVentaBoton = (
    <Button
      className={DOM.verVenta}
      variant="outlined"
      disabled={!ventaDisponible}
      onClick={() => onVerVenta(cuenta)}
    >
      {COPY.verVenta}
    </Button>
  );

  return (
    <Card className={DOM.cuenta} sx={{ p: 2 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {tituloVenta}
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: "block", color: "semantic.text.secondary" }}
          >
            {cuenta.tiendaNombre}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <StatusPill
            label={saldada ? COPY.estadoSaldada : COPY.cuentaAbierta}
            hue={saldada ? "positive" : "caution"}
          />
        </Box>
      </Stack>

      <Stack spacing={0.5} sx={{ mt: 1.5 }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {COPY.cuentaMontoOriginal}
          </Typography>
          <Typography variant="body2">
            {formatMontoEnMoneda(cuenta.montoOriginal, monedaBase)}
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {COPY.cuentaSaldo}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontVariantNumeric: "tabular-nums",
              color: saldada
                ? "semantic.text.disabled"
                : "semantic.money.neutral.main",
            }}
          >
            {formatMontoEnMoneda(cuenta.saldoPendiente, monedaBase)}
          </Typography>
        </Stack>
      </Stack>

      {/*
        The aging of a SETTLED account is never painted: the API computes it for every account,
        and showing it would be showing a number with no meaning (design § 2).
      */}
      {saldada ? (
        <Typography
          variant="body2"
          sx={{ mt: 1, color: "semantic.text.secondary" }}
        >
          {COPY.cuentaSaldadaEl}{" "}
          {cuenta.settledAt ? formatDate(new Date(cuenta.settledAt)) : ""}
        </Typography>
      ) : (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="body2">
            {formatAntiguedadDias(cuenta.dias)}
          </Typography>
          <StatusPill label={`${cuenta.bucket} días`} hue="neutral" />
        </Stack>
      )}

      {cuenta.monedaDeudaCode &&
        cuenta.monedaDeudaCode !== monedaBase &&
        cuenta.montoDeudaMonedaOriginal !== null && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 1,
              color: "semantic.money.reference.main",
            }}
          >
            {COPY.cuentaEquivale}{" "}
            {formatMontoEnMoneda(
              cuenta.montoDeudaMonedaOriginal,
              cuenta.monedaDeudaCode,
            )}
          </Typography>
        )}

      {/*
        A visible block, never a Tooltip: a Tooltip over a disabled button never fires, and on a
        touch screen there is no hover at all — the reason would never appear on the phone, which
        is where this is used (criterion 7).
      */}
      {mostrarCobrar && sinCaja && (
        <Box
          className={DOM.motivoCaja}
          sx={{
            mt: 1.5,
            p: 1.25,
            borderRadius: 1,
            bgcolor: "semantic.hue.caution.surface",
            color: "semantic.hue.caution.main",
          }}
        >
          <Typography variant="body2" sx={{ color: "inherit" }}>
            {COPY.sinCajaAbierta}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          mt: 1.5,
          pt: 1.5,
          borderTop: 1,
          borderColor: "semantic.surface.border",
        }}
      >
        {isMobile ? (
          <Stack direction="row" spacing={1} alignItems="center">
            {mostrarCobrar && (
              <Button
                className={DOM.cobrar}
                variant="contained"
                size="large"
                disabled={sinCaja}
                onClick={() => onCobrar(cuenta)}
                sx={{ flex: 1 }}
              >
                {COPY.cobrar}
              </Button>
            )}
            <IconButton
              className={DOM.accionesCuenta}
              aria-label={COPY.hojaAccionesCuenta}
              onClick={() => setSheetAbierto(true)}
              sx={{ ml: mostrarCobrar ? 0 : "auto" }}
            >
              <MoreVertIcon />
            </IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            {mostrarCobrar && (
              <Button
                className={DOM.cobrar}
                variant="contained"
                disabled={sinCaja}
                onClick={() => onCobrar(cuenta)}
              >
                {COPY.cobrar}
              </Button>
            )}
            {verVentaBoton}
            {mostrarPerdonar && (
              <Button
                className={DOM.perdonar}
                variant="text"
                color="error"
                onClick={() => onPerdonar(cuenta)}
              >
                {COPY.perdonar}
              </Button>
            )}
          </Stack>
        )}

        {!ventaDisponible && (
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 1, color: "semantic.text.disabled" }}
          >
            {COPY.ventaNoDisponible}
          </Typography>
        )}
      </Box>

      {isMobile && (
        <ActionSheet
          open={sheetAbierto}
          onClose={() => setSheetAbierto(false)}
          title={COPY.hojaAccionesCuenta}
          items={[
            {
              key: "ver-venta",
              icon: <ReceiptLongIcon />,
              label: COPY.verVenta,
              disabled: !ventaDisponible,
              onClick: () => onVerVenta(cuenta),
            },
            ...(mostrarPerdonar
              ? [
                  {
                    key: "perdonar",
                    icon: <HeartBrokenIcon />,
                    label: COPY.perdonar,
                    danger: true,
                    onClick: () => onPerdonar(cuenta),
                  },
                ]
              : []),
          ]}
        />
      )}
    </Card>
  );
}

export type { ICuentaDetalle };