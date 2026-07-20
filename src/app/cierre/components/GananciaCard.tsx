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
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { formatCurrency } from "@/utils/formatters";
import { IDeduccionItem } from "@/schemas/cierre";
import DeduccionesList from "./DeduccionesList";

interface Props {
  gananciaBruta: number;
  gananciaFinal: number;
  deducciones: IDeduccionItem[];
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  isMobile?: boolean;
  // Permite a resumen_cierre (que tiene selector de moneda de visualización
  // + modo tasa actual/histórica) formatear el bruto/final convertidos, en
  // vez del formatCurrency() plano (siempre monedaBase) usado por defecto.
  formatMonto?: (amount: number) => string;
}

// Card de "Ganancia" con desglose expandible de lo que se dedujo (gastos
// operativos, merma, devoluciones). Único componente para mostrar este dato
// — usado tanto en el cierre en vivo (cierre/page.tsx) como en el detalle
// histórico de un cierre ya cerrado (resumen_cierre/page.tsx) para que
// ambas vistas siempre muestren la misma información y el mismo desglose.
export default function GananciaCard({
  gananciaBruta,
  gananciaFinal,
  deducciones,
  onDelete,
  deletingId,
  isMobile = false,
  formatMonto = formatCurrency,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hayDeducciones = deducciones.length > 0;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: isMobile ? 1 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
          <Box
            sx={{
              p: isMobile ? 1 : 1.5,
              borderRadius: 2,
              bgcolor: gananciaFinal < 0 ? "error.light" : "info.light",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: isMobile ? 40 : 48,
              minHeight: isMobile ? 40 : 48,
            }}
          >
            <TrendingUpIcon fontSize="medium" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="baseline"
              flexWrap="wrap"
            >
              {hayDeducciones && (
                <Typography
                  variant={isMobile ? "body1" : "h6"}
                  sx={{
                    textDecoration: "line-through",
                    color: "text.disabled",
                  }}
                >
                  {formatMonto(gananciaBruta)}
                </Typography>
              )}
              <Typography
                variant={isMobile ? "h5" : "h4"}
                fontWeight="bold"
                color={gananciaFinal < 0 ? "error.main" : undefined}
                sx={{
                  fontSize: isMobile ? "1.25rem" : "2rem",
                  lineHeight: 1.2,
                  wordBreak: "break-all",
                }}
              >
                {formatMonto(gananciaFinal)}
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: isMobile ? "0.75rem" : "0.875rem",
                lineHeight: 1.2,
              }}
            >
              Ganancia
            </Typography>
          </Box>
          {hayDeducciones && (
            <Tooltip
              title={
                expanded ? "Ocultar detalle" : "Ver qué restó de la ganancia"
              }
            >
              <IconButton
                size="small"
                onClick={() => setExpanded((v) => !v)}
                aria-label={
                  expanded
                    ? "Ocultar detalle de ganancia"
                    : "Ver qué restó de la ganancia"
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
          <DeduccionesList
            items={deducciones}
            onDelete={onDelete}
            deletingId={deletingId}
          />
        </Collapse>
      </CardContent>
    </Card>
  );
}
