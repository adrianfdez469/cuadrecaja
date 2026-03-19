import React from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardActions,
  Divider,
  Stack,
  Typography,
  CardContent,
  styled
} from "@mui/material";
import {formatCurrency} from "@/utils/formatters";

interface ProductCardProps {
  name: string;
  cost: number;
  precio: number;
  stock: number;
  actions?: React.ReactNode;
  onClick?: () => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

const StockBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'stockStatus',
})<{ stockStatus: 'high' | 'low' | 'none' }>(({ theme, stockStatus }) => {
  const colors = {
    high: theme.palette.success,
    low: theme.palette.warning,
    none: theme.palette.error,
  };

  const statusColor = colors[stockStatus];

  return {
    backgroundColor: statusColor.main,
    color: statusColor.contrastText,
    padding: '8px 16px',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '80px',
    lineHeight: 1,
  };
});

function ProductCard({name, cost, precio, stock, onClick, actions}: ProductCardProps ) {
  const total = cost * stock;

  const getStockStatus = () => {
    if (stock <= 0) return 'none';
    if (stock < 5) return 'low';
    return 'high';
  };

  const getStockLabel = () => {
    if (stock <= 0) return 'sin stock';
    if (stock < 5) return 'bajo en stock';
    return 'en stock';
  };

  const status = getStockStatus();

  return (
    <StyledCard variant="outlined">
      <CardActionArea onClick={onClick} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <Box sx={{ p: 2 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography
              variant="subtitle1"
              component="div"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                lineHeight: 1.2,
                flex: 1
              }}
            >
              {name}
            </Typography>
            <StockBadge stockStatus={status}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  lineHeight: 1,
                  mb: 0.5
                }}
              >
                {stock || 0}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  fontSize: '0.65rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {getStockLabel()}
              </Typography>
            </StockBadge>
          </Stack>
        </Box>

        <Divider />

        <CardContent sx={{ py: 1.5, flexGrow: 1 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Precio:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(precio)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Costo:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(cost)}</Typography>
            </Stack>
          </Stack>
        </CardContent>

        <Divider />

        <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Costo total:</Typography>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>
              {formatCurrency(total)}
            </Typography>
          </Stack>
        </Box>
      </CardActionArea>

      {actions && (
        <>
          <Divider />
          <CardActions sx={{ justifyContent: 'flex-end', p: 1.5 }}>
            {actions}
          </CardActions>
        </>
      )}
    </StyledCard>
  );
}

export default ProductCard;