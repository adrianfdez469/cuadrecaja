"use client";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { productNameSx } from "@/theme";
import type { IMovimiento } from "@/schemas/movimiento";
import { formatDateTime, formatMovimientoMotivo } from "@/utils/formatters";
import { MovimientoCantidad } from "./MovimientoCantidad";
import { MovimientoTipoChip } from "./MovimientoTipoChip";

interface MovimientoCardProps {
  movimiento: IMovimiento;
  /**
   * For the list of a single product, where the product name is already in the
   * dialog title two centimetres above: repeating it on every card pushes down
   * the only data that changes between them. The supplier stays — on a
   * consigned product it varies from one movement to the next.
   */
  hideProductName?: boolean;
}

/**
 * One stock movement, as a card.
 *
 * Whoever opens either movement list is reconstructing a story — what happened
 * to this stock, when, why and who did it — so the card always carries the
 * seven data points, no matter which screen it belongs to. It is the single
 * shape both lists share: while each one drew its own, the general list had no
 * before/after count and the per-product modal squeezed a table on phones and
 * dropped the reason and the author on the way.
 *
 * Read-only on purpose: no `onClick`, no action menu.
 */
export function MovimientoCard({
  movimiento,
  hideProductName = false,
}: Readonly<MovimientoCardProps>) {
  // The supplier the API returns at the movement's own level — the one that
  // says who this particular entry came from, not the product's default.
  const proveedor =
    movimiento.proveedor?.nombre ??
    movimiento.productoTienda?.proveedor?.nombre;
  const motivo = formatMovimientoMotivo(movimiento.motivo);

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Box
          display="flex"
          justifyContent="space-between"
          // With no product name the left column is just supplier and chip, so
          // centring lines the chip up with the quantity instead of hanging it.
          alignItems={hideProductName ? "center" : "flex-start"}
          gap={1.5}
        >
          <Box sx={{ minWidth: 0 }}>
            {!hideProductName && (
              <Typography
                sx={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  lineHeight: 1.35,
                  ...productNameSx,
                }}
              >
                {movimiento.productoTienda?.producto?.nombre ||
                  "Producto no encontrado"}
              </Typography>
            )}
            {proveedor && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.25 }}
              >
                {proveedor}
              </Typography>
            )}
            <Box sx={{ mt: 0.75 }}>
              <MovimientoTipoChip tipo={movimiento.tipo} />
            </Box>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            <MovimientoCantidad movimiento={movimiento} size="card" />
          </Box>
        </Box>

        {motivo && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {motivo}
          </Typography>
        )}

        <Stack
          direction="row"
          alignItems="center"
          sx={{ mt: 1.5, pt: 1.25, borderTop: 1, borderColor: "divider" }}
        >
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(movimiento.fecha)}
          </Typography>
          {/* Someone or something always made it: a blank here reads as a
              movement with no author. */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: "auto" }}
          >
            {movimiento.usuario?.nombre || "Sistema"}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
