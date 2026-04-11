"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { IGastoTienda } from "@/schemas/gastos";
import {
  TIPO_CALCULO_LABELS,
  TIPO_CALCULO_COLORS,
  RECURRENCIA_LABELS,
  RECURRENCIA_COLORS,
} from "@/constants/gastos";
import { formatearCuandoAplica } from "@/utils/gastos";

interface Props {
  gasto: IGastoTienda;
  canManage: boolean;
  onEdit: (gasto: IGastoTienda) => void;
  onDelete: (gasto: IGastoTienda) => void;
  onToggleActivo: (gasto: IGastoTienda) => void;
}

function formatValor(gasto: IGastoTienda): string {
  if (gasto.tipoCalculo === "MONTO_FIJO") {
    return `$${(gasto.monto ?? 0).toFixed(2)}`;
  }
  return `${gasto.porcentaje ?? 0}%`;
}

export default function GastoTiendaCard({ gasto, canManage, onEdit, onDelete, onToggleActivo }: Props) {
  return (
    <Card
      sx={{
        opacity: gasto.activo ? 1 : 0.6,
        border: gasto.activo ? undefined : "1px solid",
        borderColor: "divider",
      }}
    >
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={1}>
          {/* Cabecera */}
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1} mr={1}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: "0.875rem" }}>
                {gasto.nombre}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
                {gasto.categoria}
              </Typography>
            </Box>
            <Chip
              label={RECURRENCIA_LABELS[gasto.recurrencia]}
              size="small"
              sx={{
                backgroundColor: RECURRENCIA_COLORS[gasto.recurrencia],
                color: "#fff",
                height: 20,
                fontSize: "0.6875rem",
              }}
            />
          </Box>

          {/* Tipo de cálculo + valor */}
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={TIPO_CALCULO_LABELS[gasto.tipoCalculo]}
              size="small"
              sx={{
                backgroundColor: TIPO_CALCULO_COLORS[gasto.tipoCalculo],
                color: "#fff",
                height: 20,
                fontSize: "0.6875rem",
              }}
            />
            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: "0.875rem" }}>
              {formatValor(gasto)}
            </Typography>
          </Box>

          {/* Cuándo aplica */}
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem" }}>
            {formatearCuandoAplica(gasto)}
          </Typography>

          {/* Acciones */}
          {canManage && (
            <Box display="flex" justifyContent="space-between" alignItems="center" pt={0.5}>
              <Tooltip title={gasto.activo ? "Desactivar" : "Activar"}>
                <Switch
                  size="small"
                  checked={gasto.activo}
                  onChange={() => onToggleActivo(gasto)}
                />
              </Tooltip>
              <Box>
                <IconButton size="small" onClick={() => onEdit(gasto)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(gasto)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
