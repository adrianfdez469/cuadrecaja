"use client";

import { useState } from "react";
import {
  Box,
  Card,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
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
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Profit on the flipped ground.
          It is the number the whole screen exists to produce, and it used to
          be one tile among seven identical ones — same size, same white card,
          distinguished only by a tinted icon. The redesign gives it the only
          black panel on the page and the largest figure in the app after the
          charge bar's total. */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: isMobile ? 2 : 3.5,
          p: isMobile ? 2 : 3,
          bgcolor: "semantic.surface.inverse",
          color: "semantic.text.onInverse",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            sx={{
              flex: 1,
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "semantic.text.onInverseMuted",
            }}
          >
            Ganancia
          </Typography>
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
                sx={{ color: "semantic.text.onInverseMuted" }}
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

        <Box sx={{ minWidth: 0 }}>
          {hayDeducciones && (
            <Typography
              sx={{
                textDecoration: "line-through",
                color: "semantic.text.onInverseMuted",
                fontSize: isMobile ? "0.9375rem" : "1.0625rem",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatMonto(gananciaBruta)}
            </Typography>
          )}
          <Typography
            sx={{
              fontSize: isMobile ? "2.125rem" : "3.25rem",
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
              wordBreak: "break-all",
              // A loss is the one case that overrides the inverse ink: it has
              // to read as a loss even here.
              ...(gananciaFinal < 0 && { color: "semantic.hue.negative.main" }),
            }}
          >
            {formatMonto(gananciaFinal)}
          </Typography>
        </Box>
      </Box>

      {/* The breakdown stays on the light ground: `DeduccionesList` is shared
          with other screens and knows nothing about being on black. */}
      <Collapse in={expanded}>
        <Box sx={{ p: isMobile ? 1.5 : 2, bgcolor: "background.paper" }}>
          <DeduccionesList
            items={deducciones}
            onDelete={onDelete}
            deletingId={deletingId}
          />
        </Box>
      </Collapse>
    </Card>
  );
}
