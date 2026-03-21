import React from 'react';
import { Box, Typography, styled } from '@mui/material';

type StockStatus = 'high' | 'low' | 'none';

interface StockBadgeProps {
  stock: number;
}

const StyledStockBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'stockStatus',
})<{ stockStatus: StockStatus }>(({ theme, stockStatus }) => {
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

const getStockStatus = (stock: number): StockStatus => {
  if (stock <= 0) return 'none';
  if (stock < 5) return 'low';
  return 'high';
};

const getStockLabel = (stock: number): string => {
  if (stock <= 0) return 'sin stock';
  if (stock < 5) return 'bajo en stock';
  return 'en stock';
};

const StockBadge: React.FC<StockBadgeProps> = ({ stock }) => {
  const status = getStockStatus(stock);

  return (
    <StyledStockBadge stockStatus={status}>
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
        {getStockLabel(stock)}
      </Typography>
    </StyledStockBadge>
  );
};

export default StockBadge;
