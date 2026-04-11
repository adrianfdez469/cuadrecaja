"use client";

import {
  Box,
  Chip,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
import { IGastoTienda } from "@/schemas/gastos";
import {
  TIPO_CALCULO_LABELS,
  TIPO_CALCULO_COLORS,
  RECURRENCIA_LABELS,
  RECURRENCIA_COLORS,
} from "@/constants/gastos";
import { formatearCuandoAplica } from "@/utils/gastos";

interface Props {
  gastos: IGastoTienda[];
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

export default function GastoTiendaTable({ gastos, canManage, onEdit, onDelete, onToggleActivo }: Props) {
  if (gastos.length === 0) {
    return (
      <Box py={4} textAlign="center">
        <Typography color="text.secondary">No hay gastos configurados para esta tienda</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nombre</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell>Tipo de cálculo</TableCell>
            <TableCell>Valor</TableCell>
            <TableCell>Recurrencia</TableCell>
            <TableCell>Cuándo aplica</TableCell>
            {canManage && <TableCell align="center">Activo</TableCell>}
            {canManage && <TableCell align="center">Acciones</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {gastos.map((gasto) => (
            <TableRow
              key={gasto.id}
              sx={{ opacity: gasto.activo ? 1 : 0.5 }}
            >
              <TableCell>
                <Box display="flex" alignItems="center" gap={0.5}>
                  {gasto.plantillaId && (
                    <Tooltip title="Derivado de una plantilla del negocio">
                      <LinkIcon fontSize="small" color="action" />
                    </Tooltip>
                  )}
                  <Typography variant="body2">{gasto.nombre}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {gasto.categoria}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={TIPO_CALCULO_LABELS[gasto.tipoCalculo]}
                  size="small"
                  sx={{
                    backgroundColor: TIPO_CALCULO_COLORS[gasto.tipoCalculo],
                    color: "#fff",
                    fontSize: "0.6875rem",
                  }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="bold">
                  {formatValor(gasto)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={RECURRENCIA_LABELS[gasto.recurrencia]}
                  size="small"
                  sx={{
                    backgroundColor: RECURRENCIA_COLORS[gasto.recurrencia],
                    color: "#fff",
                    fontSize: "0.6875rem",
                  }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {formatearCuandoAplica(gasto)}
                </Typography>
              </TableCell>
              {canManage && (
                <TableCell align="center">
                  <Switch
                    size="small"
                    checked={gasto.activo}
                    onChange={() => onToggleActivo(gasto)}
                  />
                </TableCell>
              )}
              {canManage && (
                <TableCell align="center">
                  <IconButton size="small" onClick={() => onEdit(gasto)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => onDelete(gasto)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
