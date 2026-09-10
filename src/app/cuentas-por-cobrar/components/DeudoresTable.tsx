"use client";

import {
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
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

interface DeudoresTableProps {
  deudores: IDeudorRow[];
  monedaBase: string;
  /** From 900 px up: the `Cuentas` column and the debtor's phone. CONTENT, not size. */
  isWide: boolean;
  onVerDetalle: (clienteId: string) => void;
}

/**
 * The debtor table from 600 px up.
 *
 * The seventh column and the phone line are MOUNTED CONDITIONALLY, never hidden with
 * `display: none`: `textContent` walks through a hidden node, so hiding would leave the text in
 * the DOM and make the width criteria pass against a screen that is wrong.
 */
export function DeudoresTable({
  deudores,
  monedaBase,
  isWide,
  onVerDetalle,
}: DeudoresTableProps) {
  return (
    <TableContainer className={DOM.lista}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{COPY.columnaCliente}</TableCell>
            <TableCell align="right">{COPY.columnaSaldo}</TableCell>
            <TableCell>{COPY.columnaAntiguedad}</TableCell>
            <TableCell>{COPY.columnaUltimoAbono}</TableCell>
            {isWide && (
              <TableCell align="right">{COPY.columnaCuentas}</TableCell>
            )}
            <TableCell>{COPY.columnaEstado}</TableCell>
            <TableCell align="right">{COPY.columnaAcciones}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {deudores.map((deudor) => {
            const conDeuda = deudor.estado === "CON_DEUDA";
            return (
              <TableRow
                key={deudor.clienteId}
                className={DOM.fila}
                hover
                sx={{
                  height: touch.min,
                  "&:hover": { bgcolor: "semantic.surface.sunken" },
                }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {deudor.clienteNombre}
                  </Typography>
                  {isWide && deudor.telefono && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        color: "semantic.text.secondary",
                      }}
                    >
                      {deudor.telefono}
                    </Typography>
                  )}
                </TableCell>

                <TableCell align="right">
                  <Typography
                    variant="body2"
                    sx={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: conDeuda
                        ? "semantic.money.neutral.main"
                        : "semantic.text.disabled",
                    }}
                  >
                    {formatMontoEnMoneda(deudor.saldo, monedaBase)}
                  </Typography>
                </TableCell>

                <TableCell>
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
                </TableCell>

                <TableCell>
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
                </TableCell>

                {isWide && (
                  <TableCell align="right">
                    <Typography variant="body2">
                      {deudor.cuentasAbiertas}
                    </Typography>
                  </TableCell>
                )}

                <TableCell>
                  <StatusPill
                    label={conDeuda ? COPY.estadoConDeuda : COPY.estadoSaldada}
                    hue={conDeuda ? "caution" : "positive"}
                  />
                </TableCell>

                <TableCell align="right">
                  <Tooltip title={COPY.verDetalle}>
                    <IconButton
                      aria-label={COPY.verDetalle}
                      onClick={() => onVerDetalle(deudor.clienteId)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
