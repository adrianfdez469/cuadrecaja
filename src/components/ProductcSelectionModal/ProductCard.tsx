import React, { useState } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardActions,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Typography,
  CardContent,
  styled
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
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

const StyledCard = styled(Card)(() => ({
  display: 'flex',
  flexDirection: 'column',
}));

function ProductCard({name, cost, precio, stock, onClick, actions}: ProductCardProps ) {
  const [expanded, setExpanded] = useState(false);

  return (
    <StyledCard variant="outlined">
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <CardActionArea onClick={onClick} sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ px: 1.5, py: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="body2"
                component="div"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  lineHeight: 1.3,
                  flex: 1,
                }}
              >
                {name}
              </Typography>
              <StockBadge stock={stock} />
            </Stack>
          </Box>
        </CardActionArea>
        <IconButton
          size="small"
          onClick={() => setExpanded(v => !v)}
          sx={{ p: 0.5, mx: 0.5, flexShrink: 0 }}
        >
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Divider />
        <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
          <Stack spacing={0.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">Precio:</Typography>
              <Typography variant="caption" fontWeight={600}>{formatCurrency(precio)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">Costo:</Typography>
              <Typography variant="caption" fontWeight={600}>{formatCurrency(cost)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">Costo total:</Typography>
              <Typography variant="caption" fontWeight={700} color="primary">{formatCurrency(cost * stock)}</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Collapse>

      {actions && (
        <>
          <Divider />
          <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
            {actions}
          </CardActions>
        </>
      )}
    </StyledCard>
  );
}

export default ProductCard;