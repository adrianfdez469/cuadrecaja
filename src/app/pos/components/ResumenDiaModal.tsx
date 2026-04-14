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
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AssessmentIcon from "@mui/icons-material/Assessment";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
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
  const dec = p.permiteDecimal ? 2 : 0;
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
                {formatDecimal(p.cantidadInicial, dec)}
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
                {formatDecimal(p.cantidadFinal, dec)}
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
                {formatDecimal(p.ventas, dec)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={4}>
            <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.25}>
                Entradas
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} color="success.main">
                {formatDecimal(p.entradas, dec)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={4}>
            <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.25}>
                Salidas
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} color="warning.main">
                {formatDecimal(p.salidas, dec)}
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
  const [showAll, setShowAll] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const fetchData = async (soloConMovimientos: boolean) => {
    if (!cierreId) return;
    setLoading(true);
    try {
      const result = await getResumenDia(tiendaId, cierreId, soloConMovimientos);
      setData(result);
      setAllLoaded(!soloConMovimientos);
    } catch (error) {
      console.error("[ResumenDiaModal] Error al cargar resumen", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setShowAll(false);
      setAllLoaded(false);
      fetchData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleToggleShowAll = () => {
    const next = !showAll;
    setShowAll(next);
    // Si abrimos el ojo por primera vez y aún no tenemos todos los datos → fetch
    if (next && !allLoaded) {
      fetchData(false);
    }
    // Cerrar ojo o ya tener todos los datos → solo filtro en memoria
  };

  const handleRefresh = () => {
    // Refresh respeta el estado actual del ojo
    fetchData(!showAll);
  };

  const gruposProductos = useMemo(() => {
    const productos = data?.productos ?? [];
    const filtered = productos.filter((p) => {
      const matchSearch = normalizeSearch(p.nombre).includes(filterTerm);
      const matchToggle = showAll || p.tieneMovimientos;
      return matchSearch && matchToggle;
    });

    const groupMap = new Map<string, { categoriaNombre: string; categoriaColor: string; productos: IResumenDiaProducto[] }>();
    for (const p of filtered) {
      if (!groupMap.has(p.categoriaId)) {
        groupMap.set(p.categoriaId, { categoriaNombre: p.categoriaNombre, categoriaColor: p.categoriaColor, productos: [] });
      }
      groupMap.get(p.categoriaId)!.productos.push(p);
    }

    // Ordenar productos dentro de cada grupo por ultimaModificacion desc (null al final)
    for (const group of groupMap.values()) {
      group.productos.sort((a, b) => {
        if (!a.ultimaModificacion && !b.ultimaModificacion) return 0;
        if (!a.ultimaModificacion) return 1;
        if (!b.ultimaModificacion) return -1;
        return b.ultimaModificacion.localeCompare(a.ultimaModificacion);
      });
    }

    // Ordenar grupos alfabéticamente
    return Array.from(groupMap.values()).sort((a, b) =>
      a.categoriaNombre.localeCompare(b.categoriaNombre)
    );
  }, [data?.productos, filterTerm, showAll]);

  const totalProductos = gruposProductos.reduce((acc, g) => acc + g.productos.length, 0);

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
        <Typography variant="h6" fontWeight={700} component="span">
          Punto de partida y comportamiento
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={handleRefresh} disabled={loading} title="Actualizar">
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

        {/* Búsqueda + toggle */}
        <Stack direction="row" spacing={1} mb={2} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <SearchInput
              onSearch={setFilterTerm}
              placeholder="Buscar producto... (mín. 3 letras)"
            />
          </Box>
          <Tooltip title={showAll ? "Mostrando todos los productos" : "Mostrando solo productos con movimientos"}>
            <IconButton
              size="small"
              onClick={handleToggleShowAll}
              color={showAll ? "primary" : "default"}
              sx={{ flexShrink: 0 }}
            >
              {showAll ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>

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
          {!loading && data && totalProductos === 0 && (
            <Box display="flex" flexDirection="column" alignItems="center" py={6} color="text.secondary">
              <AssessmentIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2">No hay productos para mostrar</Typography>
            </Box>
          )}

          {/* Vista móvil: Cards agrupadas */}
          {totalProductos > 0 && isMobile && (
            <Stack spacing={2}>
              {gruposProductos.map((group) => (
                <Box key={group.categoriaNombre}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: group.categoriaColor, flexShrink: 0 }} />
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                      {group.categoriaNombre}
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    {group.productos.map((p) => (
                      <ProductoCard key={p.productoTiendaId} p={p} />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}

          {/* Vista escritorio: Tabla agrupada */}
          {totalProductos > 0 && !isMobile && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell align="right">Inicial</TableCell>
                    <TableCell align="right" sx={{ color: "error.light" }}>Ventas</TableCell>
                    <TableCell align="right" sx={{ color: "success.main" }}>Entradas</TableCell>
                    <TableCell align="right" sx={{ color: "warning.main" }}>Salidas</TableCell>
                    <TableCell align="right">Existencia</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gruposProductos.map((group) => (
                    <>
                      <TableRow key={`cat-${group.categoriaNombre}`}>
                        <TableCell colSpan={6} sx={{ py: 0.5, bgcolor: "action.hover" }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: group.categoriaColor }} />
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                              {group.categoriaNombre}
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                      {group.productos.map((p) => {
                        const dec = p.permiteDecimal ? 2 : 0;
                        return (
                          <TableRow key={p.productoTiendaId} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>{p.nombre}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color={p.cantidadInicial < 0 ? "error.main" : "text.primary"}>
                                {formatDecimal(p.cantidadInicial, dec)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="error.light">{formatDecimal(p.ventas, dec)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="success.main">{formatDecimal(p.entradas, dec)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="warning.main">{formatDecimal(p.salidas, dec)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600} color={getExistenciaColor(p.cantidadFinal)}>
                                {formatDecimal(p.cantidadFinal, dec)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
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
