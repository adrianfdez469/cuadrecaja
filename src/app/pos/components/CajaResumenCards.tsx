"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { IResumenCajaMoneda } from "@/schemas/resumenCaja";
import { formatMontoEnMoneda } from "@/utils/formatters";

interface IProps {
  resumen: IResumenCajaMoneda[];
}

function CajaResumenMonedaCard({ item }: { item: IResumenCajaMoneda }) {
  return (
    <Card elevation={2}>
      <CardContent sx={{ py: 1.5 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={0.5}
        >
          <Chip label={item.monedaCode} size="small" />
          <Typography variant="h6" fontWeight="bold">
            {formatMontoEnMoneda(item.totalEsperado, item.monedaCode)}
          </Typography>
        </Stack>
        <Divider sx={{ my: 1 }} />
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption" color="textSecondary">
            Fondo inicial
          </Typography>
          <Typography variant="caption">
            {formatMontoEnMoneda(item.fondoInicial, item.monedaCode)}
          </Typography>
        </Box>
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption" color="textSecondary">
            Ventas reales
          </Typography>
          <Typography variant="caption">
            {formatMontoEnMoneda(item.ventasEfectivo, item.monedaCode)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// Fondo inicial y efectivo real de caja, por moneda, del período abierto —
// usado en el resumen de "Mis Ventas" del POS.
export default function CajaResumenCards({ resumen }: IProps) {
  if (resumen.length === 0) return null;

  return (
    <Box mb={3}>
      <Typography variant="body2" color="textSecondary" mb={1}>
        Caja
      </Typography>
      <Grid container spacing={2}>
        {resumen.map((item) => (
          <Grid item xs={12} sm={4} key={item.monedaCode}>
            <CajaResumenMonedaCard item={item} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
