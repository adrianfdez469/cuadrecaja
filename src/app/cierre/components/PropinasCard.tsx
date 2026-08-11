"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import { formatCurrency, formatMontoEnMoneda } from "@/utils/formatters";
import type { IResumenMonedaCierre } from "@/schemas/cierre";

interface Props {
  /** Total tipped in the period, in base currency. */
  totalTips: number;
  /** Who took them — the breakdown needed to hand them out. */
  tipsPorUsuario?: { id: string; nombre: string; total: number }[];
  /** Per-currency split, so cash tips can be counted out of the drawer. */
  resumenMonedas?: IResumenMonedaCierre[];
  isMobile?: boolean;
  /** Lets resumen_cierre format in its own display currency. */
  formatMonto?: (amount: number) => string;
}

/**
 * Tips of the period, kept visually apart from every sales figure on the
 * page: this money passed through the drawer but was never the business's
 * revenue, so it appears in neither `totalVentas` nor the profit card.
 */
export default function PropinasCard({
  totalTips,
  tipsPorUsuario = [],
  resumenMonedas = [],
  isMobile = false,
  formatMonto = formatCurrency,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const porMoneda = resumenMonedas
    .map((moneda) => ({
      monedaCode: moneda.monedaCode,
      tipCash: moneda.tipCash ?? 0,
      tipTransfer: moneda.tipTransfer ?? 0,
    }))
    .filter((moneda) => moneda.tipCash > 0 || moneda.tipTransfer > 0);

  const hayDetalle = tipsPorUsuario.length > 0 || porMoneda.length > 0;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: isMobile ? 1 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
          <Box
            sx={{
              p: isMobile ? 1 : 1.5,
              borderRadius: 2,
              bgcolor: "secondary.light",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: isMobile ? 40 : 48,
              minHeight: isMobile ? 40 : 48,
            }}
          >
            <VolunteerActivismIcon fontSize="medium" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant={isMobile ? "h5" : "h4"}
              fontWeight="bold"
              sx={{
                fontSize: isMobile ? "1.25rem" : "2rem",
                lineHeight: 1.2,
                wordBreak: "break-all",
              }}
            >
              {formatMonto(totalTips)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: isMobile ? "0.75rem" : "0.875rem",
                lineHeight: 1.2,
              }}
            >
              Propinas
            </Typography>
          </Box>
          {hayDetalle && (
            <Tooltip
              title={expanded ? "Ocultar detalle" : "Ver quién generó propinas"}
            >
              <IconButton
                size="small"
                onClick={() => setExpanded((v) => !v)}
                aria-label={
                  expanded
                    ? "Ocultar detalle de propinas"
                    : "Ver quién generó propinas"
                }
                sx={{ p: 1 }}
              >
                {expanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1.5 }} />

          {tipsPorUsuario.length > 0 && (
            <Box mb={porMoneda.length > 0 ? 1.5 : 0}>
              <Typography variant="caption" color="text.secondary">
                Por cajero
              </Typography>
              {tipsPorUsuario
                .slice()
                .sort((a, b) => b.total - a.total)
                .map((usuario) => (
                  <Stack
                    key={usuario.id}
                    direction="row"
                    justifyContent="space-between"
                    gap={1}
                    mt={0.25}
                  >
                    <Typography variant="body2" noWrap>
                      {usuario.nombre}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {formatMonto(usuario.total)}
                    </Typography>
                  </Stack>
                ))}
            </Box>
          )}

          {porMoneda.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Por moneda
              </Typography>
              {porMoneda.map((moneda) => (
                <Stack
                  key={moneda.monedaCode}
                  direction="row"
                  justifyContent="space-between"
                  gap={1}
                  mt={0.25}
                >
                  <Typography variant="body2">{moneda.monedaCode}</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {/* Split by method because only the cash part can be
                        handed out from the drawer at closing. */}
                    {moneda.tipCash > 0 &&
                      `${formatMontoEnMoneda(moneda.tipCash, moneda.monedaCode)} efectivo`}
                    {moneda.tipCash > 0 && moneda.tipTransfer > 0 && " · "}
                    {moneda.tipTransfer > 0 &&
                      `${formatMontoEnMoneda(moneda.tipTransfer, moneda.monedaCode)} transf.`}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}
