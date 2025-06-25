"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  Stack,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Divider
} from "@mui/material";
import { 
  Delete, 
  Edit, 
  Add,
  Category,
  Palette,
  ColorLens,
  Label,
  Search,
  Refresh,
  ExpandLess,
  ExpandMore
} from "@mui/icons-material";
import { fetchCategories, createCategory, updateCategory, deleteCategory } from "@/services/categoryService";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";

interface ICategory {
  id: string;
  nombre: string;
  color: string;
}

export default function CategoriasPage() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ICategory | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#1976d2");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
      showMessage("Error al cargar categorías", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (category: ICategory | null = null) => {
    setEditingCategory(category);
    setNombre(category ? category.nombre : "");
    setColor(category ? category.color : "#1976d2");
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCategory(null);
    setNombre("");
    setColor("#1976d2");
  };

  const handleSave = async () => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, nombre, color);
        showMessage('Categoría actualizada exitosamente', 'success');
      } else {
        await createCategory(nombre, color);
        showMessage('Categoría creada exitosamente', 'success');
      }
      await loadCategories();
      handleClose();
    } catch (error) {
      console.error("Error al guardar categoría:", error);
      showMessage('Error al guardar la categoría', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    confirmDialog('¿Está seguro que desea eliminar la categoría?', async () => {
      try {
        await deleteCategory(id);
        showMessage('Categoría eliminada', 'success');
      } catch (error) {
        console.log(error);
        showMessage('Error al intentar eliminar la categoría. Es probable que esté en uso!', 'error');
      } finally {
        await loadCategories();
      }
    });
  };

  const filteredCategories = categories.filter((category) =>
    category.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos para estadísticas
  const totalCategorias = categories.length;
  const coloresUnicos = [...new Set(categories.map(c => c.color))].length;
  const categoriasVisibles = filteredCategories.length;

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Categorías' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar categorías">
        <IconButton onClick={loadCategories} disabled={loading} size="small">
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
        {isMobile ? "Agregar" : "Agregar Categoría"}
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
            {React.isValidElement(icon) 
              ? React.cloneElement(icon, { 
                  fontSize: isMobile ? "small" : "large" 
                } as Record<string, unknown>)
              : icon
            }
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
          Cargando categorías...
        </Typography>
      </Box>
    );
  }

  return (
    <PageContainer
      title="Gestión de Categorías"
      subtitle={!isMobile ? "Organiza tus productos con categorías personalizadas" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas de categorías */}
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Collapse in={statsExpanded}>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={4}>
                <StatCard
                  icon={<Category />}
                  value={totalCategorias.toLocaleString()}
                  label="Total"
                  color="primary.light"
                />
              </Grid>
              <Grid item xs={4}>
                <StatCard
                  icon={<Palette />}
                  value={coloresUnicos.toLocaleString()}
                  label="Colores"
                  color="success.light"
                />
              </Grid>
              <Grid item xs={4}>
                <StatCard
                  icon={<Label />}
                  value={categoriasVisibles.toLocaleString()}
                  label="Visibles"
                  color="info.light"
                />
              </Grid>
            </Grid>
            <Divider sx={{ mb: 2 }} />
          </Collapse>
        </Box>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<Category />}
              value={totalCategorias.toLocaleString()}
              label="Total Categorías"
              color="primary.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<Palette />}
              value={coloresUnicos.toLocaleString()}
              label="Colores Únicos"
              color="success.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<Label />}
              value={categoriasVisibles.toLocaleString()}
              label="Categorías Visibles"
              color="info.light"
            />
          </Grid>
        </Grid>
      )}

      {/* Lista de categorías */}
      <ContentCard 
        title="Lista de Categorías"
        subtitle={!isMobile ? "Haz clic en cualquier categoría para editarla" : undefined}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar categoría..."}
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
        {filteredCategories.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Category sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {searchTerm ? 'No se encontraron categorías' : 'No hay categorías registradas'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega categorías para organizar mejor tus productos'}
              </Typography>
            </Box>
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards más densos
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {filteredCategories.map((categoria) => (
                <Card 
                  key={categoria.id}
                  onClick={() => handleOpen(categoria)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack spacing={1.5}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: 1,
                              bgcolor: categoria.color,
                              border: '1px solid',
                              borderColor: 'divider'
                            }}
                          />
                          <Typography variant="subtitle2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                            {categoria.nombre}
                          </Typography>
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(categoria.id);
                          }}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                        Color: {categoria.color}
                      </Typography>
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
                  <TableCell>Color</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCategories.map((categoria) => (
                  <TableRow 
                    key={categoria.id}
                    onClick={() => handleOpen(categoria)}
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
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: 1,
                            bgcolor: categoria.color,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                        />
                        <Typography variant="body2" fontWeight="medium">
                          {categoria.nombre}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {categoria.color}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Editar categoría">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpen(categoria);
                            }}
                            size="small"
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar categoría">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(categoria.id);
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
      
      {/* Dialog para crear/editar categoría */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField 
              fullWidth 
              label="Nombre" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Bebidas, Snacks, Limpieza..."
            />
            
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Color de la categoría
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <TextField 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  sx={{ width: 80 }}
                />
                <Box
                  sx={{
                    width: 60,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: color,
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ColorLens sx={{ color: 'white', fontSize: 16 }} />
                </Box>
                <Chip 
                  label={nombre || "Vista previa"}
                  size="small"
                  sx={{ 
                    bgcolor: color,
                    color: 'white',
                    fontWeight: 'medium'
                  }}
                />
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            color="primary"
            disabled={!nombre.trim()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
