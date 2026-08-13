"use client";

import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";

interface SaleExtrasSummaryProps {
  /** Lo que se devolvió al cliente, por moneda. */
  vueltoDetalle?: IVueltoLinea[] | null;
  /** Propina total, en moneda base. */
  tipTotal?: number | null;
  /** Desglose de la propina por moneda y forma de pago, si se registró. */
  tipDetail?: IPagoLinea[] | null;
  /** Moneda base del negocio, para expresar `tipTotal`. */
  monedaBase: string;
}

/**
 * Una fila "concepto — importe" sobre un fondo tenue del mismo tono que el
 * importe. El fondo se deriva con `alpha` en vez de un shade tipo
 * `warning.50`: el theme solo define main/light/dark para warning y success,
 * así que ese shade no existe y la fila quedaría sin fondo.
 */
function ExtraRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "warning" | "success";
}) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      gap={1}
      sx={{
        py: 0.5,
        px: 1,
        borderRadius: 1,
        bgcolor: (theme) => alpha(theme.palette[tone].main, 0.08),
      }}
    >
      <Typography variant="body2">{label}</Typography>
      <Typography variant="body2" fontWeight="medium" color={`${tone}.main`}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Vuelto y propina de una venta — lo que se devolvió y lo que no era del
 * negocio. Vive aparte porque las dos pantallas que muestran el detalle de
 * una venta lo necesitan igual: el diálogo de /ventas y el cajón del POS.
 *
 * No renderiza nada cuando la venta no tuvo ni vuelto ni propina, así que
 * quien lo usa puede montarlo sin condicionar.
 */
export function SaleExtrasSummary({
  vueltoDetalle,
  tipTotal,
  tipDetail,
  monedaBase,
}: SaleExtrasSummaryProps) {
  const vuelto = (vueltoDetalle ?? []).filter((linea) => linea.monto > 0);
  const propina = Number(tipTotal || 0);
  const propinaLineas = (tipDetail ?? []).filter((linea) => linea.monto > 0);

  if (vuelto.length === 0 && propina <= 0) return null;

  return (
    <Stack spacing={2}>
      {vuelto.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Vuelto entregado
          </Typography>
          <Stack spacing={0.5}>
            {vuelto.map((linea, index) => (
              <ExtraRow
                key={`${linea.moneda}-${index}`}
                label="Vuelto"
                value={formatMontoEnMoneda(linea.monto, linea.moneda)}
                tone="warning"
              />
            ))}
          </Stack>
        </Box>
      )}

      {propina > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Propina
          </Typography>
          <Stack spacing={0.5}>
            {/* El desglose solo aparece cuando aporta algo que el total no
                dice ya: en qué moneda y por qué vía entró la propina. */}
            {propinaLineas.length > 0 ? (
              propinaLineas.map((linea, index) => (
                <ExtraRow
                  key={`${linea.tipo}-${linea.moneda}-${index}`}
                  label={`${linea.tipo === "cash" ? "Efectivo" : "Transferencia"} (${linea.moneda})`}
                  value={formatMontoEnMoneda(linea.monto, linea.moneda)}
                  tone="success"
                />
              ))
            ) : (
              <ExtraRow
                label="Propina"
                value={formatMontoEnMoneda(propina, monedaBase)}
                tone="success"
              />
            )}
          </Stack>
          {propinaLineas.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mt={0.5}
            >
              Total propina: {formatMontoEnMoneda(propina, monedaBase)}
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );
}
