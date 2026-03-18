import React from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardActions,
  Chip, Divider,
  Stack,
  Typography
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

function ProductCard({name, cost, precio, stock, onClick, actions}: ProductCardProps ) {
  return (
      <Card>
        <CardActionArea onClick={onClick}>
          <Box sx={{ p: 2 }}>
            <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Typography gutterBottom variant="h5" component="div">
                {name}
              </Typography>
              <Typography gutterBottom variant="h2" component="div">
                {stock}
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1}>
              <Chip color="success" label={`Costo: ${formatCurrency(cost)}`} size="small" />
              <Chip color="success" label={`Precio: ${formatCurrency(precio)}`} size="small" />
              <Chip color="success" label={`Costo total: ${formatCurrency(cost*stock)}`} size="small" />
            </Stack>
          </Box>
          <Divider />
          {actions && (
              <CardActions>
                {actions}
              </CardActions>
          )}
        </CardActionArea>

      </Card>
  );
}

export default ProductCard;