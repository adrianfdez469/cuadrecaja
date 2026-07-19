"use client";

import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { formatCurrency } from "@/utils/formatters";
import { IDeduccionItem, IDeduccionTipo } from "@/schemas/cierre";

interface Props {
  items: IDeduccionItem[];
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  emptyMessage?: string;
}

const TIPO_LABELS: Record<IDeduccionTipo, string> = {
  GASTO: "Gasto",
  MERMA: "Merma",
  DEVOLUCION: "Devolución de venta",
  COMPRA: "Compra",
};

const TIPO_COLORS: Record<IDeduccionTipo, string> = {
  GASTO: "#5c6bc0",
  MERMA: "#c62828",
  DEVOLUCION: "#ad1457",
  COMPRA: "#ef6c00",
};

function DeduccionRow({
  item,
  onDelete,
  deletingId,
}: {
  item: IDeduccionItem;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
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
          <Chip
            label={TIPO_LABELS[item.tipo]}
            size="small"
            sx={{
              backgroundColor: TIPO_COLORS[item.tipo],
              color: "#fff",
              height: 18,
              fontSize: "0.625rem",
              flexShrink: 0,
            }}
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
          -{formatCurrency(item.monto)}
        </Typography>
        {onDelete && item.tipo === "GASTO" && item.esAdHoc && (
          <Tooltip title="Eliminar gasto">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={deletingId === item.id}
                onClick={() => onDelete(item.id)}
                sx={{ p: 0.25 }}
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
