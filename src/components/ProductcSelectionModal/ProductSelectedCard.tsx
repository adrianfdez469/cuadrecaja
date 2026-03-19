"use client";

import React from 'react';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  IconButton,
  Stack,
  Typography,
  TextField,
  Divider,
  styled,
  ButtonGroup,
  Button
} from "@mui/material";
import { Add, Remove, Delete } from "@mui/icons-material";
import { formatCurrency } from "@/utils/formatters";

interface ProductSelectedCardProps {
  name: string;
  providerName?: string;
  existencia: number;
  cantidad: number;
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

const QuantitySelector = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: '8px',
  width: 'fit-content',
  backgroundColor: theme.palette.background.paper,
}));

const QuantityButton = styled(IconButton)(({ theme }) => ({
  padding: theme.spacing(1),
  borderRadius: 0,
  backgroundColor: theme.palette.action.hover,
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
  '&.Mui-disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
  }
}));

const QuantityInput = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    '& fieldset': {
      border: 'none',
      borderLeft: `1px solid ${theme.palette.divider}`,
      borderRight: `1px solid ${theme.palette.divider}`,
    },
    '& input': {
      textAlign: 'center',
      padding: '8px 4px',
      // width: '50px',
      MozAppearance: 'textfield',
      '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
        WebkitAppearance: 'none',
        margin: 0,
      },
    },
  },
}));

const ProductSelectedCard: React.FC<ProductSelectedCardProps> = ({
  name,
  providerName,
  existencia,
  cantidad,
  costoUnitario,
  costoTotal,
  esSalida,
  disabledCantidad,
  disabledCosto,
  onActualizarCantidad,
  onActualizarCosto,
  onEliminar,
}) => {
  const handleDecrement = () => {
    if (cantidad > 1) {
      onActualizarCantidad(cantidad - 1);
    }
  };

  const handleIncrement = () => {
    if (esSalida && cantidad >= existencia) return;
    onActualizarCantidad(cantidad + 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val)) {
      onActualizarCantidad(val);
    }
  };

  return (
    <StyledCard variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={2}>
          {/* 1. Top: Product Name and Existence */}
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
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

          {/* 2. Middle: Quantity Selector */}
          <Box display="flex" justifyContent="center">
            <QuantitySelector>
              <QuantityButton
                size="small"
                onClick={handleDecrement}
                disabled={disabledCantidad || cantidad <= 1}
              >
                <Remove fontSize="small" />
              </QuantityButton>
              <QuantityInput
                variant="outlined"
                size="medium"
                value={cantidad}
                onChange={handleInputChange}
                disabled={disabledCantidad}
                inputProps={{
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                  min: 1,
                  max: esSalida ? existencia : undefined
                }}
              />
              <QuantityButton
                size="small"
                onClick={handleIncrement}
                disabled={disabledCantidad || (esSalida && cantidad >= existencia)}
              >
                <Add fontSize="small" />
              </QuantityButton>
            </QuantitySelector>
          </Box>

          <Divider />

          {/* 3. Cost Section */}
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography variant="body2" fontWeight="medium" color="text.secondary">
              Costo:
            </Typography>
            {!disabledCosto && (
              <TextField
                type="number"
                size="small"
                value={costoUnitario ? costoUnitario.toString() : 0}
                onChange={(e) => onActualizarCosto(Number(e.target.value))}
                slotProps={{
                  input: {
                    startAdornment: <Typography variant="body2" sx={{ mr: 0.5 }}>$</Typography>,
                  },
                  htmlInput: {
                    min: 0,
                    step: 0.01,
                    style: { textAlign: 'right' }
                  }
                }}
                sx={{ width: '120px' }}
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
