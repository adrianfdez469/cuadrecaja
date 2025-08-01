"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Grid,
  Stack,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import InventoryIcon from "@mui/icons-material/Inventory";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import DescriptionIcon from "@mui/icons-material/Description";
import TableViewIcon from "@mui/icons-material/TableView";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import axios from "axios";
import { IProductoTiendaV2 } from "@/types/IProducto";
import { exportInventoryToWord } from "@/utils/wordExport";
import { exportInventarioToExcel } from "@/utils/excelExport";
import { ProductMovementsModal } from "./components/ProductMovementsModal";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatCurrency, formatNumber } from '@/utils/formatters';

export default function InventarioPage() {
  const [productos, setProductos] = useState<IProductoTiendaV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<IProductoTiendaV2 | null>(null);
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const response = await axios.get<IProductoTiendaV2[]>(
        `/api/productos_tienda/${user.localActual.id}/productos_venta`
      );
      console.log('productos', response.data);
      
      setProductos(response.data.map(productoTienda => {
        return {
          ...productoTienda,
          producto: {
            ...productoTienda.producto,
            nombre: productoTienda.proveedor ? `${productoTienda.producto.nombre} - ${productoTienda.proveedor.nombre}` : productoTienda.producto.nombre
          }
        };
      }));
    } catch (error) {
      console.error("Error al obtener productos", error);
      showMessage("Error al cargar el inventario", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingContext) {
      fetchProductos();
    }
  }, [loadingContext]);

  const handleExportToWord = async () => {
    try {
      setExporting(true);
      
      const productosParaExportar = productos.filter(producto => producto.precio > 0);
      
      if (productosParaExportar.length === 0) {
        showMessage("No hay productos con precio para exportar", "warning");
        return;
      }

      await exportInventoryToWord({
        productos: productosParaExportar,
        tiendaNombre: user.localActual.nombre,
        fecha: new Date()
      });

      showMessage(`Inventario exportado exitosamente (${productosParaExportar.length} productos)`, "success");
    } catch (error) {
      console.error("Error al exportar inventario:", error);
      showMessage("Error al exportar el inventario", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportToExcel = async () => {
    try {
      setExporting(true);
      
      const productosParaExportar = productos.filter(producto => producto.precio > 0);
      
      if (productosParaExportar.length === 0) {
        showMessage("No hay productos con precio para exportar", "warning");
        return;
      }

      await exportInventarioToExcel({
        productos: productosParaExportar,
        tiendaNombre: user.localActual.nombre,
        fecha: new Date()
      });

      showMessage(`Inventario exportado a Excel exitosamente (${productosParaExportar.length} productos)`, "success");
    } catch (error) {
      console.error("Error al exportar inventario a Excel:", error);
      showMessage("Error al exportar el inventario a Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleRowClick = (producto: IProductoTiendaV2) => {
    setSelectedProduct(producto);
    setMovementsModalOpen(true);
  };

  const handleCloseMovementsModal = () => {
    setMovementsModalOpen(false);
    setSelectedProduct(null);
  };

  const filteredProductos = productos.filter((producto) =>
    producto.producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos para estadísticas
  const totalProductos = productos.length;
  const productosConStock = productos.filter(p => p.existencia > 0).length;
  const productosSinStock = productos.filter(p => p.existencia <= 0).length;
  const valorTotalInventario = productos.reduce((total, p) => total + (p.existencia * p.costo), 0);

  const getStockChip = (existencia: number) => {
    if (existencia <= 0) {
      return <Chip label="Sin Stock" color="error" size="small" />;
    } else if (existencia <= 5) {
      return <Chip label="Bajo Stock" color="warning" size="small" />;
    } else {
      return <Chip label="En Stock" color="success" size="small" />;
    }
  };

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' }
  ];

  const headerActions = (
    <Stack direction={isMobile ? "column" : "row"} spacing={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
      <Tooltip title="Actualizar inventario">
        <IconButton onClick={fetchProductos} disabled={loading} size={isMobile ? "small" : "medium"}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      <Button
        variant="outlined"
        startIcon={!isMobile ? <DescriptionIcon /> : undefined}
        onClick={handleExportToWord}
        disabled={exporting || loading || productos.length === 0}
        size={isMobile ? "small" : "medium"}
        fullWidth={isMobile}
      >
        {exporting ? "Exportando..." : isMobile ? "Word" : "Exportar Word"}
      </Button>
      <Button
        variant="contained"
        startIcon={!isMobile ? <TableViewIcon /> : undefined}
        onClick={handleExportToExcel}
        disabled={exporting || loading || productos.length === 0}
        size={isMobile ? "small" : "medium"}
        fullWidth={isMobile}
      >
        {exporting ? "Exportando..." : isMobile ? "Excel" : "Exportar Excel"}
      </Button>
    </Stack>
  );

  // Componente de estadística móvil optimizado
  const StatCard = ({ icon, value, label, color }: { icon: React.ReactNode, value: string, label: string, color: string }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isMobile ? 1 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
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

  return (
    <PageContainer
      title="Inventario"
      subtitle={!isMobile ? "Gestión y control de productos en stock" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas del inventario */}
      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: isMobile ? 3 : 4 }}>
        <Grid item xs={6} sm={4} md={6}>
          <StatCard
            icon={<InventoryIcon fontSize={"medium"} />}
            value={totalProductos.toLocaleString()}
            label="Total Productos"
            color="primary.light"
          />
        </Grid>

        <Grid item xs={6} sm={4} md={6}>
          <StatCard
            icon={<TrendingUpIcon fontSize={"medium"} />}
            value={productosConStock.toLocaleString()}
            label="Con Stock"
            color="success.light"
          />
        </Grid>

        <Grid item xs={12} sm={4} md={6}>
          <StatCard
            icon={<TrendingDownIcon fontSize={"medium"} />}
            value={productosSinStock.toLocaleString()}
            label="Sin Stock"
            color="error.light"
          />
        </Grid>

        <Grid item xs={12} sm={12} md={6}>
          <StatCard
            icon={<AttachMoneyIcon fontSize={"medium"} />}
            value={`$${valorTotalInventario.toLocaleString()}`}
            label="Valor Total"
            color="info.light"
          />
        </Grid>
      </Grid>

      {/* Tabla de productos */}
      <ContentCard 
        title="Lista de Productos"
        subtitle={!isMobile ? "Haz clic en cualquier producto para ver su historial de movimientos" : undefined}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar producto..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ 
              minWidth: isMobile ? 200 : 250,
              maxWidth: isMobile ? 250 : 'none'
            }}
          />
        }
        noPadding
        fullHeight
      >
        {isMobile ? (
          // Vista móvil con cards
          <Box sx={{ p: 2 }}>
            {loading ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Cargando inventario...
                </Typography>
              </Box>
            ) : filteredProductos.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  {searchTerm ? 'No se encontraron productos' : 'No hay productos en el inventario'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega productos para comenzar'}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {filteredProductos.map((producto) => (
                  <Card 
                    key={producto.id}
                    onClick={() => handleRowClick(producto)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Stack spacing={2}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Typography variant="subtitle1" fontWeight="medium" sx={{ flex: 1, pr: 1 }}>
                            {producto.producto.nombre}
                          </Typography>
                          {getStockChip(producto.existencia)}
                        </Box>
                        
                        <Grid container spacing={2}>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">
                              Existencia
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              color={producto.existencia <= 0 ? "error" : "inherit"}
                            >
                              {formatNumber(producto.existencia)}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">
                              Costo
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(producto.costo)}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">
                              Valor Stock
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(producto.existencia * producto.costo)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="right">Existencia</TableCell>
                  <TableCell align="right">Precio</TableCell>
                  {!isTablet && <TableCell align="right">Costo</TableCell>}
                  <TableCell align="right">Valor Stock</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell align="center" colSpan={isTablet ? 5 : 6} sx={{ py: 8 }}>
                      <CircularProgress />
                      <Typography variant="body2" sx={{ mt: 2 }}>
                        Cargando inventario...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredProductos.length === 0 ? (
                  <TableRow>
                    <TableCell align="center" colSpan={isTablet ? 5 : 6} sx={{ py: 8 }}>
                      <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        {searchTerm ? 'No se encontraron productos' : 'No hay productos en el inventario'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega productos para comenzar'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProductos.map((producto) => (
                    <TableRow 
                      key={producto.id}
                      onClick={() => handleRowClick(producto)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                        '&:nth-of-type(odd)': {
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {producto.producto.nombre}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {getStockChip(producto.existencia)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={producto.existencia <= 0 ? "error" : "inherit"}
                          fontWeight={producto.existencia <= 0 ? "bold" : "normal"}
                        >
                          {formatNumber(producto.existencia)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(producto.precio)}
                        </Typography>
                      </TableCell>
                      {!isTablet && (
                        <TableCell align="right">
                          <Typography variant="body2">
                            {formatCurrency(producto.costo)}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(producto.existencia * producto.costo)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Modal de movimientos */}
      <ProductMovementsModal
        open={movementsModalOpen}
        onClose={handleCloseMovementsModal}
        producto={selectedProduct}
      />
    </PageContainer>
  );
} 
