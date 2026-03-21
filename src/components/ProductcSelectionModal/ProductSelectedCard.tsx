"use client";
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Stack,
  Typography,
  Divider,
  styled,
} from "@mui/material";
import { Delete } from "@mui/icons-material";
import {formatCurrency} from "@/utils/formatters";
import NumberSpinner from "@/components/NumberSpinner";
import NumberField from "@/components/NumberField";

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
  marginBottom: theme.spacing(2),
  borderRadius: '12px',
  boxShadow: 'none',
  border: `1px solid ${theme.palette.divider}`,
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

  const handleQuantityChange = ( value) => {
    onActualizarCantidad(value);
  };

  const handleCostChange = (val) => {
    onActualizarCosto(val);
  }

  return (
    <StyledCard variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={2}>
          {/* 1. Top: Product Name and Existence */}
          <Box display="flex" justifyContent="space-between" gap={1} alignItems="center">
            <Box>
              <Typography variant="subtitle1"  sx={{ lineHeight: 1.2 }}>
                {name}
              </Typography>
              {providerName && (
                <Typography variant="caption" color="text.secondary">
                  {providerName}
                </Typography>
              )}
            </Box>
            <Typography variant="h3" fontWeight="bold">
              {existencia}
            </Typography>
          </Box>

          <Divider />

          <Box display="flex" justifyContent="center">
            <NumberSpinner
                size="medium"
                value={Number(cantidad)}
                onValueChange={handleQuantityChange}
                disabled={disabledCantidad}
                step={permiteDecimal ? 0.01 : 1}
                min={1}
                max={esSalida ? existencia : undefined}
            />
          </Box>

          <Divider />

          {/* 3. Cost Section */}
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography variant="body2" fontWeight="medium" color="text.secondary">
              Costo:
            </Typography>
            {!disabledCosto && (
                <NumberField
                    value={costoUnitario}
                    onValueChange={handleCostChange}
                    min={1}
                    step={0.01}
                    size="small"
                />

            )}
          </Box>

          <Divider />

          {/* 4. Footer: Total and Delete */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight="bold">
              Total
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
