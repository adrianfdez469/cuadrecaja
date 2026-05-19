"use client";

import { Box, Card, CardContent, Typography, useTheme, useMediaQuery } from "@mui/material";
import InventoryIcon from "@mui/icons-material/Inventory";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { formatCurrency } from "@/utils/formatters";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Card sx={{ flex: 1, minWidth: isMobile ? 140 : 160 }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ color, display: "flex" }}>{icon}</Box>
          <Box>
            <Typography variant="caption" color="text.secondary" lineHeight={1}>
              {label}
            </Typography>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
              {value}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

interface InventarioStatsRowProps {
  productos: IProductoTiendaV2[];
}

export function InventarioStatsRow({ productos }: InventarioStatsRowProps) {
  const total = productos.length;
  const conStock = productos.filter(p => p.existencia > 0).length;
  const sinStock = productos.filter(p => p.existencia <= 0).length;
  const valorInventario = productos.reduce((acc, p) => acc + p.existencia * p.costo, 0);

  return (
    <Box display="flex" gap={1.5} flexWrap="wrap" mb={2}>
      <StatCard label="Total productos" value={total} icon={<InventoryIcon fontSize="small" />} color="primary.main" />
      <StatCard label="Con stock" value={conStock} icon={<TrendingUpIcon fontSize="small" />} color="success.main" />
      <StatCard label="Sin stock" value={sinStock} icon={<TrendingDownIcon fontSize="small" />} color="error.main" />
      <StatCard label="Valor inventario" value={formatCurrency(valorInventario)} icon={<AttachMoneyIcon fontSize="small" />} color="warning.main" />
    </Box>
  );
}
