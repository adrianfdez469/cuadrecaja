"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  Stack,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  Collapse,
  Divider
} from "@mui/material";
import { 
  Delete, 
  Edit, 
  Add,
  ShoppingCart,
  Category,
  Inventory,
  LocalOffer,
  Percent,
  Search,
  Refresh,
  ExpandMore,
  ExpandLess
} from "@mui/icons-material";
import { ProductoForm } from "./components/product.form";
import {
  createProduct,
  deleteProduct,
  editProduct,
  fetchProducts,
} from "@/services/productServise";
import { IProducto } from "@/types/IProducto";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import LimitDialog from "@/components/LimitDialog";

export default function ProductList() {
  const [products, setProducts] = useState<IProducto[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [limitDialog, setLimitDialog] = useState(false);
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const prods = await fetchProducts();
      setProducts(prods);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      showMessage("Error al cargar productos", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (prodEdit?: IProducto) => {
    if(prodEdit){
      setEditingProd(prodEdit);
    } else {
      setOpen(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProd(null);
  };

  const handleSave = async (
    nombre: string,
    descripcion: string,
    categoriaId: string,
    fraccion?: { fraccionDeId?: string; unidadesPorFraccion?: number }
  ) => {
    try {
      if (editingProd) {
        await editProduct(editingProd.id, nombre, descripcion, categoriaId, fraccion);
        showMessage('Producto actualizado exitosamente', 'success');
      } else {
        await createProduct(nombre, descripcion, categoriaId, fraccion);
        showMessage('Producto creado exitosamente', 'success');
      }
      await loadProducts();
      handleClose();
    } catch (error) {
      console.error("Error al guardar producto:", error);
      
      // Manejar específicamente el error de límite de productos
      if (error.response?.status === 400 && 
          error.response?.data?.error?.includes("Límite de productos excedido")) {
        setLimitDialog(true);
      } else {
        showMessage(
          error.response?.data?.error || 'Error al guardar el producto', 
          'error'
        );
      }
    }
  };

  const handleDelete = async (id: string) => {
    confirmDialog('¿Está seguro que desea eliminar el producto?', async () => {
      try {
        await deleteProduct(id);
        showMessage('Producto eliminado', 'success');
      } catch (error) {
        console.log(error);
        showMessage('Error al intentar eliminar el producto. Es probable que esté en uso!', 'error');
      } finally {
        await loadProducts();
      }
    });
  };

  const filteredProducts = products.filter((product) =>
    product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.categoria?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos para estadísticas
  const totalProductos = products.length;
  const productosConCategoria = products.filter(p => p.categoria).length;
  const productosSinCategoria = products.filter(p => !p.categoria).length;
  const productosConFraccion = products.filter(p => p.fraccionDe && p.unidadesPorFraccion).length;

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Productos' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar productos">
        <IconButton onClick={loadProducts} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      {isMobile && (
        <Tooltip title={statsExpanded ? "Ocultar estadísticas" : "Mostrar estadísticas"}>
          <IconButton onClick={() => setStatsExpanded(!statsExpanded)} size="small">
            {statsExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Tooltip>
      )}
      <Button
        variant="contained"
        startIcon={!isMobile ? <Add /> : undefined}
        onClick={() => handleOpen()}
        size="small"
      >
        {isMobile ? "Agregar" : "Agregar Producto"}
      </Button>
    </Stack>
  );

  // Componente de estadística móvil optimizado
  const StatCard = ({ icon, value, label, color }: { icon: React.ReactNode, value: string, label: string, color: string }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isMobile ? 1.5 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
          <Box
            sx={{
              p: isMobile ? 0.75 : 1.5,
              borderRadius: 2,
              bgcolor: color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: isMobile ? 32 : 48,
              minHeight: isMobile ? 32 : 48,
            }}
          >
            {React.cloneElement(icon as React.ReactElement, { 
              fontSize: isMobile ? "small" : "large" 
            } as any)}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography 
              variant={isMobile ? "subtitle1" : "h4"} 
              fontWeight="bold"
              sx={{ 
                fontSize: isMobile ? '1rem' : '2rem',
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
                fontSize: isMobile ? '0.6875rem' : '0.875rem',
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

  const handleCloseLimitDialog = () => {
    setLimitDialog(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
          Cargando productos...
        </Typography>
      </Box>
    );
  }

  return (
    <PageContainer
      title="Gestión de Productos"
      subtitle={!isMobile ? "Administra el catálogo de productos de tu negocio" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas de productos */}
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Collapse in={statsExpanded}>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <StatCard
                  icon={<Inventory />}
                  value={totalProductos.toLocaleString()}
                  label="Total"
                  color="primary.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Category />}
                  value={productosConCategoria.toLocaleString()}
                  label="Con Categoría"
                  color="success.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<LocalOffer />}
                  value={productosSinCategoria.toLocaleString()}
                  label="Sin Categoría"
                  color="warning.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Percent />}
                  value={productosConFraccion.toLocaleString()}
                  label="Con Fracción"
                  color="info.light"
                />
              </Grid>
            </Grid>
            <Divider sx={{ mb: 2 }} />
          </Collapse>
        </Box>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<Inventory />}
              value={totalProductos.toLocaleString()}
              label="Total Productos"
              color="primary.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<Category />}
              value={productosConCategoria.toLocaleString()}
              label="Con Categoría"
              color="success.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<LocalOffer />}
              value={productosSinCategoria.toLocaleString()}
              label="Sin Categoría"
              color="warning.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<Percent />}
              value={productosConFraccion.toLocaleString()}
              label="Con Fracción"
              color="info.light"
            />
          </Grid>
        </Grid>
      )}

      {/* Lista de productos */}
      <ContentCard 
        title="Catálogo de Productos"
        subtitle={!isMobile ? "Haz clic en cualquier producto para editarlo" : undefined}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar producto..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ 
              minWidth: isMobile ? 160 : 250,
              maxWidth: isMobile ? 200 : 'none'
            }}
          />
        }
        noPadding
        fullHeight
      >
        {filteredProducts.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <ShoppingCart sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {searchTerm ? 'No se encontraron productos' : 'No hay productos registrados'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega productos para comenzar a gestionar tu catálogo'}
              </Typography>
            </Box>
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards más densos
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {filteredProducts.map((product) => (
                <Card 
                  key={product.id}
                  onClick={() => handleOpen(product)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack spacing={1.5}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                            {product.nombre}
                          </Typography>
                          {product.descripcion && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                              {product.descripcion}
                            </Typography>
                          )}
                        </Box>
                        {product.fraccionDe && product.unidadesPorFraccion && (
                          <Chip 
                            label={`${product.fraccionDe.nombre} - ${product.unidadesPorFraccion} unidades`}
                            size="small"
                            color="info"
                            sx={{ height: 20 }}
                          />
                        )}
                      </Box>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          {product.categoria ? (
                            <Chip
                              label={product.categoria.nombre}
                              size="small"
                              sx={{
                                bgcolor: product.categoria.color,
                                color: 'white',
                                fontWeight: 'medium',
                                fontSize: '0.6875rem',
                                height: 20
                              }}
                            />
                          ) : (
                            <Chip 
                              label="Sin categoría" 
                              size="small" 
                              variant="outlined"
                              sx={{ fontSize: '0.6875rem', height: 20 }}
                            />
                          )}
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(product.id);
                          }}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell align="center">Fracción</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow 
                    key={product.id}
                    onClick={() => handleOpen(product)}
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
                        {product.nombre}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {product.descripcion || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {product.categoria ? (
                        <Chip
                          label={product.categoria.nombre}
                          size="small"
                          sx={{
                            bgcolor: product.categoria.color,
                            color: 'white',
                            fontWeight: 'medium'
                          }}
                        />
                      ) : (
                        <Chip 
                          label="Sin categoría" 
                          size="small" 
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {product.fraccionDe && product.unidadesPorFraccion ? (
                        <Chip 
                          label="Sí" 
                          size="small" 
                          color="info"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Editar producto">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpen(product);
                            }}
                            size="small"
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar producto">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(product.id);
                            }}
                            size="small"
                            color="error"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>
      
      {/* Dialog para crear/editar producto */}
      {(open || !!editingProd) && 
        <ProductoForm
          open={true}
          editingProd={editingProd || undefined}
          handleClose={handleClose}
          handleSave={handleSave}
        />
      }

      {ConfirmDialogComponent}

      {limitDialog && (
        <LimitDialog
          open={limitDialog}
          onClose={handleCloseLimitDialog}
          limitType="productos"
        />
      )}
    </PageContainer>
  );
}
