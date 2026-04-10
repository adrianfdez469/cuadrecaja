"use client";

import { FC, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Stack,
  Card,
  CardContent,
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
  return "success.main";
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
    <Card variant="outlined" sx={{ borderWidth: 2 }}>
      <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
        {/* Nombre */}
        <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
          {p.nombre}
        </Typography>

        {/* Bloque superior: Inicial + Existencia actual */}
        <Grid container spacing={1} mb={1.5}>
          <Grid size={6}>
            <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Inicial
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                color={p.cantidadInicial < 0 ? "error.main" : "text.primary"}
              >
                {formatDecimal(p.cantidadInicial)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={6}>
            <Box
              sx={{
                bgcolor: (t) => {
                  if (p.cantidadFinal <= 0) return alpha(t.palette.error.main, 0.18);
                  if (p.cantidadFinal <= 5) return alpha(t.palette.warning.main, 0.18);
                  return alpha(t.palette.success.main, 0.15);
                },
                borderRadius: 2,
                p: 1.5,
              }}
            >
              <Typography variant="caption" color={getExistenciaColor(p.cantidadFinal)} display="block" mb={0.5}>
                Existencia actual
              </Typography>
              <Typography variant="h5" fontWeight={700} color={getExistenciaColor(p.cantidadFinal)}>
                {formatDecimal(p.cantidadFinal)}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 1.5 }} />

        {/* Movimientos */}
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1 }}
        >
          Movimientos
        </Typography>
        <Grid container spacing={1}>
          <Grid size={4}>
            <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.25}>
                Ventas
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} color="error.light">
                {formatDecimal(p.ventas)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={4}>
            <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.25}>
                Entradas
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} color="success.main">
                {formatDecimal(p.entradas)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={4}>
            <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.25}>
                Salidas
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} color="warning.main">
                {formatDecimal(p.salidas)}
              </Typography>
            </Box>
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
          Punto de partida y comportamiento
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
