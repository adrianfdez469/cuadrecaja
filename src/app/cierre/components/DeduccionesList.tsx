"use client";

import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { formatCurrency, formatMontoEnMoneda } from "@/utils/formatters";
import { IDeduccionItem, IDeduccionTipo } from "@/schemas/cierre";
import { StatusPill, type PillHue } from "@/components/StatusPill";

interface Props {
  items: IDeduccionItem[];
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  emptyMessage?: string;
  // Moneda en la que vienen `item.monto` para ESTE panel. Sin especificar,
  // se asume moneda base del negocio (usa el símbolo "$"). Especificarla
  // evita mostrar "$45.00 CUP" cuando el monto en realidad no está en la
  // moneda base (ver desglose por moneda en MonedaBreakdownRow).
  monedaCode?: string;
}

const TIPO_LABELS: Record<IDeduccionTipo, string> = {
  GASTO: "Gasto",
  MERMA: "Merma",
  DEVOLUCION: "Devolución de venta",
  COMPRA: "Compra",
};

/**
 * What each deduction is, by hue rather than by hex.
 *
 * These were four saturated fills with white text — four alert-coloured
 * badges inside a breakdown that is itself already a list of subtractions.
 * They keep telling the four kinds apart, but as washes: what matters here is
 * the amount, not the label beside it.
 */
const TIPO_HUE: Record<IDeduccionTipo, PillHue> = {
  GASTO: "neutral",
  MERMA: "negative",
  DEVOLUCION: "negative",
  COMPRA: "caution",
};

function DeduccionRow({
  item,
  onDelete,
  deletingId,
  monedaCode,
}: {
  item: IDeduccionItem;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  monedaCode?: string;
}) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      gap={1}
    >
      <Box flex={1} minWidth={0}>
        <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
          <StatusPill
            label={TIPO_LABELS[item.tipo]}
            hue={TIPO_HUE[item.tipo]}
            sx={{ flexShrink: 0 }}
          />
          <Typography variant="body2" noWrap>
            {item.label}
          </Typography>
        </Box>
        {item.motivo &&
          item.motivo.trim().toLowerCase() !==
            TIPO_LABELS[item.tipo].toLowerCase() && (
            <Typography variant="caption" color="text.secondary">
              {item.motivo}
            </Typography>
          )}
      </Box>
      <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
        <Typography variant="body2" fontWeight="medium" color="error.main">
          -
          {monedaCode
            ? formatMontoEnMoneda(item.monto, monedaCode)
            : formatCurrency(item.monto)}
        </Typography>
        {onDelete && item.tipo === "GASTO" && item.esAdHoc && (
          <Tooltip title="Eliminar gasto">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={deletingId === item.id}
                onClick={() => onDelete(item.id)}
                sx={{ p: 1 }}
                aria-label={`Eliminar gasto ${item.label}`}
              >
                {deletingId === item.id ? (
                  <CircularProgress size={14} color="error" />
                ) : (
                  <DeleteOutlineIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default function DeduccionesList({
  items,
  onDelete,
  deletingId,
  emptyMessage = "Sin movimientos en este período",
}: Props) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  // Los gastos ad-hoc son los únicos eliminables — se separan del resto
  // (gastos recurrentes, merma, devoluciones, compras) con una línea.
  const fijos = items.filter((it) => !(it.tipo === "GASTO" && it.esAdHoc));
  const adHoc = items.filter((it) => it.tipo === "GASTO" && it.esAdHoc);

  return (
    <Stack spacing={0.75}>
      {fijos.map((it) => (
        <DeduccionRow
          key={it.id}
          item={it}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}

      {fijos.length > 0 && adHoc.length > 0 && (
        <Divider sx={{ my: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Gastos puntuales
          </Typography>
        </Divider>
      )}

      {adHoc.map((it) => (
        <DeduccionRow
          key={it.id}
          item={it}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </Stack>
  );
}
