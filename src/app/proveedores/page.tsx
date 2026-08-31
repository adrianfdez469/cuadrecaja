"use client";

import { useEffect, useState, useCallback } from "react";
import { StatStrip } from "@/components/StatStrip";
import { StatusPill } from "@/components/StatusPill";
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
  IconButton,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  Tooltip,
} from "@mui/material";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { LoadingState } from "@/components/LoadingState";
import { formatCurrency } from "@/utils/formatters";
import { useRouter } from "next/navigation";
import { Refresh, Visibility } from "@mui/icons-material";
import { IProveedorConsignacion } from "@/schemas/proveedor";
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
    valorConsignacion: 0,
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Simulando llamada a API
      const proveedoresConsignación = await getProveedoresConsignacion();

      setProveedores(proveedoresConsignación);

      // Calcular totales
      const totalesCalculados = proveedoresConsignación.reduce(
        (acc, proveedor) => {
          acc.totalLiquidado += proveedor.dineroLiquidado;
          acc.totalPorLiquidar += proveedor.dineroPorLiquidar;
          acc.totalProductosConsignacion +=
            proveedor.totalProductosConsignacion;
          acc.valorConsignacion += proveedor.valorConsignacion;
          return acc;
        },
        {
          totalLiquidado: 0,
          totalPorLiquidar: 0,
          totalProveedores: proveedoresConsignación.length,
          totalProductosConsignacion: 0,
          valorConsignacion: 0,
        },
      );

      setTotales(totalesCalculados);
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleVerDetalle = (proveedorId: string) => {
    router.push(`/proveedores/${proveedorId}`);
  };

  // Componente de estadística
  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Proveedores" },
  ];

  const headerActions = (
    <Stack
      direction={isMobile ? "column" : "row"}
      spacing={1}
      sx={{ width: isMobile ? "100%" : "auto" }}
    >
      <Tooltip title="Actualizar datos">
        <IconButton
          onClick={fetchData}
          disabled={loading}
          size={isMobile ? "small" : "medium"}
        >
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
        <LoadingState variant="table" />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Proveedores"
      subtitle="Gestión de proveedores, liquidaciones y productos en consignación"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      <Box sx={{ mb: 3 }}>
        <StatStrip
          variant={isMobile ? undefined : "card"}
          stats={[
            {
              label: "Total Proveedores",
              value: totales.totalProveedores.toString(),
            },
            {
              label: "Productos en Consignación",
              value: totales.totalProductosConsignacion.toString(),
            },
            {
              label: "Valor en Consignación",
              value: formatCurrency(totales.valorConsignacion),
            },
            {
              // The only figure here with a verdict attached: money that came
              // back in. The other three are counts, and counts are ink.
              label: "Dinero Liquidado",
              value: formatCurrency(totales.totalLiquidado),
              tone: "positive",
            },
            {
              label: "Por Liquidar",
              value: formatCurrency(totales.totalPorLiquidar),
            },
          ]}
        />
      </Box>

      {/* Tabla de proveedores */}
      <ContentCard
        title="Listado de Proveedores"
        subtitle={
          !isMobile
            ? `${proveedores.length} proveedores registrados`
            : undefined
        }
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
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "semantic.surface.sunken",
                    },
                  }}
                  onClick={() => handleVerDetalle(proveedor.id)}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={1.5}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        gap={1.25}
                        sx={{ minWidth: 0 }}
                      >
                        <Typography
                          variant="subtitle1"
                          fontWeight={700}
                          sx={{ lineHeight: 1.35 }}
                        >
                          {proveedor.nombre}
                        </Typography>
                        <StatusPill
                          label={proveedor.estado}
                          hue={
                            proveedor.estado === "activo"
                              ? "positive"
                              : "neutral"
                          }
                        />
                      </Stack>
                      <IconButton color="primary" sx={{ flexShrink: 0 }}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Box>

                    <Stack
                      spacing={0.5}
                      sx={{
                        mt: 1.25,
                        pt: 1.5,
                        borderTop: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="baseline"
                        gap={1.5}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Contacto
                        </Typography>
                        <Typography
                          variant="body2"
                          color={
                            proveedor.telefono
                              ? "text.primary"
                              : "text.disabled"
                          }
                        >
                          {proveedor.telefono || "—"}
                        </Typography>
                      </Box>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="baseline"
                        gap={1.5}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Dinero Liquidado
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={
                            proveedor.dineroLiquidado > 0
                              ? "success.main"
                              : "text.primary"
                          }
                        >
                          {formatCurrency(proveedor.dineroLiquidado)}
                        </Typography>
                      </Box>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="baseline"
                        gap={1.5}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Por Liquidar
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(proveedor.dineroPorLiquidar)}
                        </Typography>
                      </Box>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="baseline"
                        gap={1.5}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Productos
                        </Typography>
                        <Typography variant="body2">
                          {proveedor.totalProductosConsignacion}
                        </Typography>
                      </Box>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="baseline"
                        gap={1.5}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Valor en Consignación
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(proveedor.valorConsignacion)}
                        </Typography>
                      </Box>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="baseline"
                        gap={1.5}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Última Liquidación
                        </Typography>
                        <Typography variant="body2">
                          {proveedor.ultimaLiquidacion
                            ? new Date(
                                proveedor.ultimaLiquidacion,
                              ).toLocaleDateString()
                            : "Sin liquidar"}
                        </Typography>
                      </Box>
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
                  <TableCell align="right">Productos</TableCell>
                  <TableCell align="right">Valor en Consignación</TableCell>
                  <TableCell>Última Liquidación</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {proveedores.map((proveedor) => (
                  <TableRow
                    key={proveedor.id}
                    sx={{
                      "&:hover": {
                        backgroundColor: "semantic.surface.sunken",
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
                      <Typography
                        variant="body2"
                        color={
                          proveedor.telefono ? "text.primary" : "text.secondary"
                        }
                      >
                        {proveedor.telefono || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color={
                          proveedor.dineroLiquidado > 0
                            ? "success.main"
                            : "text.primary"
                        }
                      >
                        {formatCurrency(proveedor.dineroLiquidado)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(proveedor.dineroPorLiquidar)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {proveedor.totalProductosConsignacion}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color="secondary.main"
                      >
                        {formatCurrency(proveedor.valorConsignacion)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {proveedor.ultimaLiquidacion
                          ? new Date(
                              proveedor.ultimaLiquidacion,
                            ).toLocaleDateString()
                          : "Sin liquidar"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <StatusPill
                        label={proveedor.estado}
                        hue={
                          proveedor.estado === "activo" ? "positive" : "neutral"
                        }
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
