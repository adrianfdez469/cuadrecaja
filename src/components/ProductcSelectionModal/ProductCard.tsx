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
import StockBadge from './StockBadge';

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

function ProductCard({name, cost, precio, stock, onClick, actions}: ProductCardProps ) {
  const total = cost * stock;

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
            <StockBadge stock={stock} />
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