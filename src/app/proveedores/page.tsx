"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TablePagination,
  Grid,
  CircularProgress,
  IconButton,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  Tooltip,
  Chip,
} from "@mui/material";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatCurrency } from "@/utils/formatters";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Refresh,
  Visibility,
  Person,
  LocalShipping,
  MonetizationOn,
} from "@mui/icons-material";
import { IProveedorConsignacion } from "@/types/IProveedorConsignación";
import { getProveedoresConsignacion } from "@/services/preoveedoresService";

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<IProveedorConsignacion[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [totales, setTotales] = useState({
    totalLiquidado: 0,
    totalPorLiquidar: 0,
    totalProveedores: 0,
    totalProductosConsignacion: 0,
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();



  const fetchData = async () => {
    setLoading(true);
    try {
      // Simulando llamada a API
      const proveedoresConsignación = await getProveedoresConsignacion();
      console.log('proveedoresConsignación',proveedoresConsignación);

      setProveedores(proveedoresConsignación);

      // Calcular totales
      const totalesCalculados = proveedoresConsignación.reduce((acc, proveedor) => {
        acc.totalLiquidado += proveedor.dineroLiquidado;
        acc.totalPorLiquidar += proveedor.dineroPorLiquidar;
        acc.totalProductosConsignacion += proveedor.totalProductosConsignacion;
        return acc;
      }, {
        totalLiquidado: 0,
        totalPorLiquidar: 0,
        totalProveedores: proveedoresConsignación.length,
        totalProductosConsignacion: 0,
      });

      setTotales(totalesCalculados);
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleVerDetalle = (proveedorId: string) => {
    router.push(`/proveedores/${proveedorId}`);
  };

  // Componente de estadística
  const StatCard = ({
    icon,
    value,
    label,
    color
  }: {
    icon: React.ReactNode;
    value: string;
    label: string;
    color: string;
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isMobile ? 2 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1.5 : 2}>
          <Box
            sx={{
              p: isMobile ? 1 : 1.5,
              borderRadius: 2,
              bgcolor: color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: isMobile ? 40 : 48,
              minHeight: isMobile ? 40 : 48,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant={isMobile ? "h5" : "h4"}
              fontWeight="bold"
              sx={{
                fontSize: isMobile ? '1.25rem' : '2rem',
                lineHeight: 1.2,
                wordBreak: 'break-all'
              }}
            >
              {value}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                lineHeight: 1.2
              }}
            >
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Proveedores' }
  ];

  const headerActions = (
    <Stack direction={isMobile ? "column" : "row"} spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
      <Tooltip title="Actualizar datos">
        <IconButton onClick={fetchData} disabled={loading} size={isMobile ? "small" : "medium"}>
          <Refresh />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  if (loading) {
    return (
      <PageContainer
        title="Proveedores"
        subtitle="Gestión de proveedores y liquidaciones"
        breadcrumbs={breadcrumbs}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando proveedores...
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Proveedores"
      subtitle={!isMobile ? "Gestión de proveedores, liquidaciones y productos en consignación" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas generales */}
      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: isMobile ? 3 : 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            icon={<Person fontSize={isMobile ? "medium" : "large"} />}
            value={totales.totalProveedores.toString()}
            label="Total Proveedores"
            color="primary.light"
          />
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            icon={<MonetizationOn fontSize={isMobile ? "medium" : "large"} />}
            value={formatCurrency(totales.totalLiquidado)}
            label="Dinero Liquidado"
            color="success.light"
          />
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            icon={<TrendingUp fontSize={isMobile ? "medium" : "large"} />}
            value={formatCurrency(totales.totalPorLiquidar)}
            label="Por Liquidar"
            color="warning.light"
          />
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            icon={<LocalShipping fontSize={isMobile ? "medium" : "large"} />}
            value={totales.totalProductosConsignacion.toString()}
            label="Productos en Consignación"
            color="info.light"
          />
        </Grid>
      </Grid>

      {/* Tabla de proveedores */}
      <ContentCard
        title="Listado de Proveedores"
        subtitle={!isMobile ? `${proveedores.length} proveedores registrados` : undefined}
        noPadding
        fullHeight
      >
        {isMobile ? (
          // Vista móvil con cards
          <Box sx={{ p: 2 }}>
            <Stack spacing={2}>
              {proveedores.map((proveedor) => (
                <Card
                  key={proveedor.id}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  onClick={() => handleVerDetalle(proveedor.id)}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {proveedor.nombre}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {proveedor.telefono}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={proveedor.estado}
                            color={proveedor.estado === 'activo' ? 'success' : 'default'}
                            size="small"
                          />
                          <IconButton size="small" color="primary">
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Liquidado
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="success.main">
                            {formatCurrency(proveedor.dineroLiquidado)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Por Liquidar
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="warning.main">
                            {formatCurrency(proveedor.dineroPorLiquidar)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Productos
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {proveedor.totalProductosConsignacion}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Última Liquidación
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {proveedor.ultimaLiquidacion ? new Date(proveedor.ultimaLiquidacion).toLocaleDateString() : 'Sin liquidar'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            {/* Paginación móvil */}
            <Box sx={{ mt: 2 }}>
              <TablePagination
                component="div"
                count={proveedores.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 20, 50]}
                labelRowsPerPage="Filas por página:"
              />
            </Box>
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader size={isTablet ? "small" : "medium"}>
              <TableHead>
                <TableRow>
                  <TableCell>Proveedor</TableCell>
                  <TableCell>Contacto</TableCell>
                  <TableCell align="right">Dinero Liquidado</TableCell>
                  <TableCell align="right">Por Liquidar</TableCell>
                  <TableCell align="center">Productos</TableCell>
                  <TableCell align="center">Última Liquidación</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {proveedores.map((proveedor) => (
                  <TableRow
                    key={proveedor.id}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                      '&:nth-of-type(odd)': {
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      },
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {proveedor.nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {proveedor.direccion}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {proveedor.telefono}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium" color="success.main">
                        {formatCurrency(proveedor.dineroLiquidado)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium" color="warning.main">
                        {formatCurrency(proveedor.dineroPorLiquidar)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {proveedor.totalProductosConsignacion}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {proveedor.ultimaLiquidacion ? new Date(proveedor.ultimaLiquidacion).toLocaleDateString() : 'Sin liquidar'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={proveedor.estado}
                        color={proveedor.estado === 'activo' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver detalles">
                        <IconButton
                          onClick={() => handleVerDetalle(proveedor.id)}
                          color="primary"
                          size="small"
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginación desktop */}
            <TablePagination
              component="div"
              count={proveedores.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="Filas por página:"
            />
          </TableContainer>
        )}
      </ContentCard>
    </PageContainer>
  );
} 