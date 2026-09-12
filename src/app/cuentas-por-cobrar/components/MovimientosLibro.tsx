"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import UndoIcon from "@mui/icons-material/Undo";
import { StatusPill } from "@/components/StatusPill";
import { ActionSheet } from "@/components/ActionSheet";
import { EmptyState } from "@/components/EmptyState";
import { formatDate, formatMontoEnMoneda } from "@/utils/formatters";
import {
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
  TIPO_MOVIMIENTO_HUE,
  TIPO_MOVIMIENTO_LABEL,
} from "@/constants/cuentasPorCobrar";
import type { IMovimientoRow } from "@/lib/cuentasPorCobrar/panel";
import { touch } from "@/theme";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

interface MovimientosLibroProps {
  movimientos: IMovimientoRow[];
  monedaBase: string;
  isMobile: boolean;
  /** From 900 px up: the `Nota` column. CONTENT, not size. */
  isWide: boolean;
  puedeRevertir: boolean;
  onRevertir: (movimiento: IMovimientoRow) => void;
}

/** Whether the row offers the reversal: only a live ABONO, and only with the permission. */
function ofreceRevertir(
  movimiento: IMovimientoRow,
  puedeRevertir: boolean,
): boolean {
  return (
    puedeRevertir && movimiento.tipo === "ABONO" && movimiento.revertido === false
  );
}

function Autor({ nombre }: Readonly<{ nombre: string | null }>) {
  // "I do not know" and "I am not showing it" have to LOOK different in an audit ledger, so the
  // line is never omitted.
  return (
    <Typography
      variant="caption"
      sx={{
        display: "block",
        color: nombre ? "semantic.text.secondary" : "semantic.text.disabled",
      }}
    >
      {nombre ?? COPY.sinAutor}
    </Typography>
  );
}

/**
 * The ledger of the debtor: every account's movements flattened into one list, newest first.
 *
 * Under 600 px it is a stack of cards and there is NO `<table>` in the DOM; from 600 px up it is
 * one table. The `Nota` column only mounts from 900 px: a 300-character reason eats the space
 * the amount needs at 768.
 */
export function MovimientosLibro({
  movimientos,
  monedaBase,
  isMobile,
  isWide,
  puedeRevertir,
  onRevertir,
}: Readonly<MovimientosLibroProps>) {
  const [sheetDe, setSheetDe] = useState<IMovimientoRow | null>(null);

  if (movimientos.length === 0) {
    return (
      <Box className={DOM.libro}>
        <EmptyState
          variant="empty"
          title={COPY.libroVacioTitulo}
          description={COPY.libroVacioDescripcion}
        />
      </Box>
    );
  }

  const pills = (movimiento: IMovimientoRow) => (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
      <StatusPill
        label={TIPO_MOVIMIENTO_LABEL[movimiento.tipo]}
        hue={TIPO_MOVIMIENTO_HUE[movimiento.tipo]}
      />
      {movimiento.tipo === "ABONO" && movimiento.revertido && (
        <StatusPill label={COPY.revertido} hue="neutral" />
      )}
    </Stack>
  );

  if (isMobile) {
    return (
      <Box className={DOM.libro}>
        <Stack spacing={2}>
          {movimientos.map((movimiento) => (
            <Card
              key={movimiento.id}
              className={DOM.movimiento}
              sx={{ p: 2, minHeight: touch.rowLarge }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
              >
                <Box sx={{ minWidth: 0 }}>
                  {pills(movimiento)}
                  <Autor nombre={movimiento.usuarioNombre} />
                </Box>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography
                    variant="subtitle1"
                    sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}
                  >
                    {formatMontoEnMoneda(movimiento.monto, monedaBase)}
                  </Typography>
                  {ofreceRevertir(movimiento, puedeRevertir) && (
                    <IconButton
                      className={DOM.accionesMovimiento}
                      aria-label={COPY.hojaAccionesAbono}
                      onClick={() => setSheetDe(movimiento)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </Stack>
              </Stack>

              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ mt: 1 }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary" }}
                >
                  {formatDate(new Date(movimiento.fecha))}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary" }}
                >
                  {COPY.cuentaVentaDel}{" "}
                  {formatDate(new Date(movimiento.ventaFecha))}
                </Typography>
              </Stack>
            </Card>
          ))}
        </Stack>

        <ActionSheet
          open={sheetDe !== null}
          onClose={() => setSheetDe(null)}
          title={COPY.hojaAccionesAbono}
          items={
            sheetDe
              ? [
                  {
                    key: "revertir",
                    icon: <UndoIcon />,
                    label: COPY.revertir,
                    danger: true,
                    onClick: () => onRevertir(sheetDe),
                  },
                ]
              : []
          }
        />
      </Box>
    );
  }

  return (
    <TableContainer className={DOM.libro}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{COPY.columnaFecha}</TableCell>
            <TableCell>{COPY.columnaMovimiento}</TableCell>
            <TableCell align="right">{COPY.columnaMonto}</TableCell>
            <TableCell>{COPY.columnaVenta}</TableCell>
            {isWide && <TableCell>{COPY.columnaNota}</TableCell>}
            <TableCell align="right">{COPY.columnaAcciones}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {movimientos.map((movimiento) => (
            <TableRow
              key={movimiento.id}
              className={DOM.movimiento}
              sx={{ height: touch.min }}
            >
              <TableCell>{formatDate(new Date(movimiento.fecha))}</TableCell>
              <TableCell>
                {pills(movimiento)}
                <Autor nombre={movimiento.usuarioNombre} />
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}
                >
                  {formatMontoEnMoneda(movimiento.monto, monedaBase)}
                </Typography>
              </TableCell>
              <TableCell>
                {COPY.cuentaVentaDel}{" "}
                {formatDate(new Date(movimiento.ventaFecha))}
              </TableCell>
              {isWide && (
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ color: "semantic.text.secondary" }}
                  >
                    {movimiento.motivo ?? COPY.sinDato}
                  </Typography>
                </TableCell>
              )}
              <TableCell align="right">
                {ofreceRevertir(movimiento, puedeRevertir) && (
                  <Button
                    className={DOM.revertir}
                    variant="text"
                    color="error"
                    onClick={() => onRevertir(movimiento)}
                  >
                    {COPY.revertir}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
