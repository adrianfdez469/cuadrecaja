"use client";

import { FC, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  useMediaQuery,
  Grid2 as Grid,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { getResumenDia } from "@/services/resumenDiaService";
import { IResumenDiaProducto, IResumenDiaResponse } from "@/schemas/resumenDia";
import { formatDecimal, normalizeSearch } from "@/utils/formatters";
import SearchInput from "./SearchInput";

interface IProps {
  open: boolean;
  onClose: () => void;
  tiendaId: string;
  cierreId: string;
}

function getExistenciaColor(valor: number): string {
  if (valor <= 0) return "error.main";
  if (valor <= 5) return "warning.main";
  return "text.primary";
}

function ExistenciaChip({ valor }: { valor: number }) {
  const color = valor <= 0 ? "error" : valor <= 5 ? "warning" : "default";
  return (
    <Chip
      label={formatDecimal(valor)}
      color={color as "error" | "warning" | "default"}
      size="small"
      variant={valor <= 0 ? "filled" : "outlined"}
    />
  );
}

function TotalCard({
  label,
  valor,
  color,
  icon,
}: {
  label: string;
  valor: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
      <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ color }}>{icon}</Box>
          <Box>
            <Typography variant="caption" color="text.secondary" noWrap>
              {label}
            </Typography>
            <Typography variant="body2" fontWeight={700} color={color}>
              {formatDecimal(valor)}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ProductoCard({ p }: { p: IResumenDiaProducto }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography variant="body2" fontWeight={700} sx={{ flex: 1, mr: 1 }}>
            {p.nombre}
          </Typography>
          <ExistenciaChip valor={p.cantidadFinal} />
        </Stack>

        <Grid container spacing={0.5}>
          <Grid size={4}>
            <Typography variant="caption" color="text.secondary" display="block">
              Inicial
            </Typography>
            <Typography
              variant="body2"
              fontWeight={500}
              color={p.cantidadInicial < 0 ? "error.main" : "text.primary"}
            >
              {formatDecimal(p.cantidadInicial)}
            </Typography>
          </Grid>
          <Grid size={4}>
            <Typography variant="caption" color="text.secondary" display="block">
              Ventas
            </Typography>
            <Typography variant="body2" fontWeight={500} color="error.light">
              {formatDecimal(p.ventas)}
            </Typography>
          </Grid>
          <Grid size={4}>
            <Typography variant="caption" color="text.secondary" display="block">
              Entradas
            </Typography>
            <Typography variant="body2" fontWeight={500} color="success.main">
              {formatDecimal(p.entradas)}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              Salidas
            </Typography>
            <Typography variant="body2" fontWeight={500} color="warning.main">
              {formatDecimal(p.salidas)}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              Existencia
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              color={getExistenciaColor(p.cantidadFinal)}
            >
              {formatDecimal(p.cantidadFinal)}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

const ResumenDiaModal: FC<IProps> = ({ open, onClose, tiendaId, cierreId }) => {
  const [data, setData] = useState<IResumenDiaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterTerm, setFilterTerm] = useState("");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const fetchData = async () => {
    if (!cierreId) return;
    setLoading(true);
    try {
      const result = await getResumenDia(tiendaId, cierreId);
      setData(result);
    } catch (error) {
      console.error("[ResumenDiaModal] Error al cargar resumen", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
    // fetchData es estable en cada apertura del modal; open es la única dependencia relevante
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const productosFiltrados = useMemo(
    () =>
      data?.productos.filter((p) =>
        normalizeSearch(p.nombre).includes(filterTerm)
      ) ?? [],
    [data?.productos, filterTerm]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: isMobile ? "100%" : "90vh", display: "flex", flexDirection: "column" } }}
    >
      {/* Título */}
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, px: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Resumen del Período
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={fetchData} disabled={loading} title="Actualizar">
            <RefreshIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onClose} title="Cerrar">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", px: 2, pt: 1 }}>
        {/* Cards de totales */}
        {data && (
          <Stack direction="row" spacing={1} mb={2}>
            <TotalCard
              label="Ventas"
              valor={data.totales.ventas}
              color={theme.palette.error.light}
              icon={<ShoppingCartIcon fontSize="small" />}
            />
            <TotalCard
              label="Entradas"
              valor={data.totales.entradas}
              color={theme.palette.success.main}
              icon={<TrendingUpIcon fontSize="small" />}
            />
            <TotalCard
              label="Salidas"
              valor={data.totales.salidas}
              color={theme.palette.warning.main}
              icon={<TrendingDownIcon fontSize="small" />}
            />
          </Stack>
        )}

        {/* Búsqueda */}
        <SearchInput
          onSearch={setFilterTerm}
          placeholder="Buscar producto... (mín. 3 letras)"
          sx={{ mb: 2 }}
        />

        {/* Área de productos con overlay de carga */}
        <Box sx={{ flex: 1, overflow: "auto", position: "relative" }}>
          {/* Overlay / máscara de carga */}
          {loading && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {/* Sin datos */}
          {!loading && data && productosFiltrados.length === 0 && (
            <Box display="flex" flexDirection="column" alignItems="center" py={6} color="text.secondary">
              <AssessmentIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2">No hay productos para mostrar</Typography>
            </Box>
          )}

          {/* Vista móvil: Cards */}
          {productosFiltrados.length > 0 && isMobile && (
            <Stack spacing={1.5}>
              {productosFiltrados.map((p) => (
                <ProductoCard key={p.productoTiendaId} p={p} />
              ))}
            </Stack>
          )}

          {/* Vista escritorio: Tabla */}
          {productosFiltrados.length > 0 && !isMobile && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell align="right">Inicial</TableCell>
                    <TableCell align="right" sx={{ color: "error.light" }}>
                      Ventas
                    </TableCell>
                    <TableCell align="right" sx={{ color: "success.main" }}>
                      Entradas
                    </TableCell>
                    <TableCell align="right" sx={{ color: "warning.main" }}>
                      Salidas
                    </TableCell>
                    <TableCell align="right">Existencia</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productosFiltrados.map((p) => (
                    <TableRow key={p.productoTiendaId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {p.nombre}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={p.cantidadInicial < 0 ? "error.main" : "text.primary"}
                        >
                          {formatDecimal(p.cantidadInicial)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.light">
                          {formatDecimal(p.ventas)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="success.main">
                          {formatDecimal(p.entradas)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="warning.main">
                          {formatDecimal(p.salidas)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={getExistenciaColor(p.cantidadFinal)}
                        >
                          {formatDecimal(p.cantidadFinal)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ResumenDiaModal;
