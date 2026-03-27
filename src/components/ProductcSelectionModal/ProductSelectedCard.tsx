"use client";
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Stack,
  Typography,
  styled,
} from "@mui/material";
import { Delete } from "@mui/icons-material";
import {formatCurrency} from "@/utils/formatters";
import NumberSpinner from "@/components/NumberSpinner";
import NumberField from "@/components/NumberField";
import StockBadge from './StockBadge';

interface ProductSelectedCardProps {
  name: string;
  providerName?: string;
  existencia: number;
  cantidad: number;
  permiteDecimal: boolean;
  costoUnitario?: number;
  costoTotal: number;
  esSalida: boolean;
  disabledCantidad?: boolean;
  disabledCosto?: boolean;
  onActualizarCantidad: (nuevaCantidad: number) => void;
  onActualizarCosto: (nuevoCosto: number) => void;
  onEliminar: () => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  borderRadius: '8px',
  boxShadow: 'none',
  border: `3px solid ${theme.palette.divider}`,
}));

const ProductSelectedCard: React.FC<ProductSelectedCardProps> = ({
  name,
  providerName,
  existencia,
  cantidad,
  permiteDecimal,
  costoUnitario,
  costoTotal,
  esSalida,
  disabledCantidad,
  disabledCosto,
  onActualizarCantidad,
  onActualizarCosto,
  onEliminar,
}) => {
  return (
    <StyledCard variant="outlined">
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1}>

          {/* Fila 1: nombre + stock + eliminar */}
          <Box display="flex" alignItems="center" gap={1}>
            <Box flex={1} minWidth={0}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {name}
              </Typography>
              {providerName && (
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {providerName}
                </Typography>
              )}
            </Box>
            <StockBadge stock={existencia} />
          </Box>

          {/*<Divider />*/}

          {/* Fila 2: spinner + costo + total */}
          <Stack direction="row" alignItems="center" gap={2} justifyContent="space-between">
            <NumberSpinner
                size="small"
                value={Number(cantidad)}
                onValueChange={onActualizarCantidad}
                disabled={disabledCantidad}
                step={permiteDecimal ? 0.01 : 1}
                min={1}
                max={esSalida ? existencia : undefined}
            />

            <NumberField
                sx={{ width: 150 }}
                size="small"
                label="Costo"
                value={costoUnitario}
                readOnly={disabledCosto}
                disabled={disabledCosto}
                onValueChange={onActualizarCosto}
                min={0}
                defaultValue={0}
                step={0.01}
            />
          </Stack>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight="bold">
              Total:
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h6" fontWeight="bold">
                {formatCurrency(costoTotal)}
              </Typography>
              <IconButton
                  size="small"
                  color="error"
                  onClick={onEliminar}
                  sx={{ p: 0.5 }}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </StyledCard>
  );
};

export default ProductSelectedCard;
