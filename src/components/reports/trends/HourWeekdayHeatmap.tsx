"use client";

import {
  Alert,
  Box,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import type { IHourWeekdayCell } from "@/schemas/reports/salesTrends";

type HourWeekdayHeatmapProps = {
  cells: IHourWeekdayCell[];
  maxVentas: number;
  pico: { weekday: number; hour: number; ventasNetas: number } | null;
  format: (amountInBase: number) => string;
};

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOURS = 24;

/**
 * Revenue by weekday and hour.
 *
 * Hand-built from a CSS grid: MUI X only ships Heatmap in its Pro tier, and a
 * fixed 7×24 grid needs no charting library anyway.
 */
export function HourWeekdayHeatmap({
  cells,
  maxVentas,
  pico,
  format,
}: HourWeekdayHeatmapProps) {
  const theme = useTheme();

  if (maxVentas <= 0) {
    return (
      <ContentCard title="Ventas por hora y día de la semana">
        <Alert severity="info">No hay datos disponibles para el período</Alert>
      </ContentCard>
    );
  }

  // Index by slot so lookup stays O(1) while rendering 168 cells.
  const bySlot = new Map<number, IHourWeekdayCell>();
  for (const cell of cells) bySlot.set(cell.weekday * HOURS + cell.hour, cell);

  return (
    <ContentCard
      title="Ventas por hora y día de la semana"
      subtitle={
        pico
          ? `Pico: ${WEEKDAY_LABELS[pico.weekday]} a las ${String(pico.hour).padStart(2, "0")}:00 — ${format(pico.ventasNetas)}`
          : undefined
      }
    >
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 620 }}>
          {/* Hour ruler: label every third hour to stay legible. */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `36px repeat(${HOURS}, 1fr)`,
              gap: "2px",
              mb: "2px",
            }}
          >
            <Box />
            {Array.from({ length: HOURS }, (_, hour) => (
              <Typography
                key={hour}
                variant="caption"
                align="center"
                color="text.secondary"
                sx={{ fontSize: "0.6rem" }}
              >
                {hour % 3 === 0 ? hour : ""}
              </Typography>
            ))}
          </Box>

          {WEEKDAY_LABELS.map((label, weekday) => (
            <Box
              key={label}
              sx={{
                display: "grid",
                gridTemplateColumns: `36px repeat(${HOURS}, 1fr)`,
                gap: "2px",
                mb: "2px",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.7rem", lineHeight: "22px" }}
              >
                {label}
              </Typography>

              {Array.from({ length: HOURS }, (_, hour) => {
                const cell = bySlot.get(weekday * HOURS + hour);
                const value = cell?.ventasNetas ?? 0;
                // Square-root scale: linear intensity makes every cell but the
                // peak look empty when one slot dominates.
                const intensity = value > 0 ? Math.sqrt(value / maxVentas) : 0;

                return (
                  <Tooltip
                    key={hour}
                    title={
                      value > 0
                        ? `${label} ${String(hour).padStart(2, "0")}:00 — ${format(value)} (${cell?.transacciones ?? 0} ventas)`
                        : `${label} ${String(hour).padStart(2, "0")}:00 — sin ventas`
                    }
                    arrow
                  >
                    <Box
                      sx={{
                        height: 22,
                        borderRadius: 0.5,
                        bgcolor:
                          intensity > 0
                            ? theme.palette.primary.main
                            : theme.palette.semantic.surface.sunken,
                        opacity: intensity > 0 ? 0.25 + intensity * 0.75 : 1,
                        cursor: "default",
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          ))}

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ mt: 1 }}
          >
            <Typography variant="caption" color="text.secondary">
              Menos
            </Typography>
            {[0.15, 0.4, 0.65, 0.85, 1].map((step) => (
              <Box
                key={step}
                sx={{
                  width: 18,
                  height: 12,
                  borderRadius: 0.5,
                  bgcolor: theme.palette.primary.main,
                  opacity: 0.25 + step * 0.75,
                }}
              />
            ))}
            <Typography variant="caption" color="text.secondary">
              Más
            </Typography>
          </Stack>
        </Box>
      </Box>
    </ContentCard>
  );
}
