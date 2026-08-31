"use client";

import {
  Box,
  Card,
  CardContent,
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
  RECURRENCIA_LABELS,
  TIPO_CALCULO_LABELS,
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

/** One label/value line inside the card. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="baseline" gap={1.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textAlign: "right" }}>
        {value}
      </Typography>
    </Box>
  );
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
        <Stack spacing={0}>
          {/* Cabecera: el nombre a la izquierda y el importe grande a la
              derecha. El valor es lo que se viene a leer de un gasto, así que
              deja de ir en línea con el resto de la letra pequeña. */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            gap={1.5}
          >
            <Box minWidth={0}>
              <Typography variant="h6" sx={{ lineHeight: 1.35 }}>
                {gasto.nombre}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {gasto.categoria}
              </Typography>
            </Box>
            <Typography
              variant="h4"
              sx={{ flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }}
            >
              {formatValor(gasto)}
            </Typography>
          </Box>

          {/* Los tres datos como pares etiqueta/valor. Eran dos chips de color
              saturado y una línea suelta: tres tratamientos distintos para tres
              hechos del mismo rango. */}
          <Stack
            spacing={0.5}
            sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}
          >
            <MetaRow label="Tipo de cálculo" value={TIPO_CALCULO_LABELS[gasto.tipoCalculo]} />
            <MetaRow label="Recurrencia" value={RECURRENCIA_LABELS[gasto.recurrencia]} />
            <MetaRow label="Cuándo aplica" value={formatearCuandoAplica(gasto)} />
          </Stack>

          {/* Acciones */}
          {canManage && (
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mt: 1.25, pt: 0.75, borderTop: 1, borderColor: "divider" }}
            >
              <Box display="flex" alignItems="center" gap={1.25}>
                <Tooltip title={gasto.activo ? "Desactivar" : "Activar"}>
                  <Switch
                    checked={gasto.activo}
                    onChange={() => onToggleActivo(gasto)}
                  />
                </Tooltip>
                <Typography variant="body2" fontWeight={600}>
                  Activo
                </Typography>
              </Box>
              <Box display="flex" gap={0.5}>
                <IconButton onClick={() => onEdit(gasto)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton color="error" onClick={() => onDelete(gasto)}>
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
