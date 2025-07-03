"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  Alert
} from "@mui/material";
import { 
  Delete, 
  Edit, 
  Add,
  Business,
  Phone,
  LocationOn,
  Person,
  Search,
  Refresh,
  ExpandMore,
  ExpandLess,
  LocalShipping
} from "@mui/icons-material";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from "@/services/proveedorService";
import { IProveedor, IProveedorCreate, IProveedorUpdate } from "@/types/IProveedor";

export default function Proveedores() {
  const [proveedores, setProveedores] = useState<IProveedor[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<IProveedor | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statsExpanded, setStatsExpanded] = useState(false);
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    setLoading(true);
    try {
      const response = await getProveedores();
      setProveedores(response);
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
      showMessage("Error al cargar los proveedores", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      showMessage("El nombre es obligatorio", "error");
      return;
    }

    setSaving(true);
    try {
      const proveedorData: IProveedorCreate | IProveedorUpdate = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        direccion: direccion.trim() || undefined,
        telefono: telefono.trim() || undefined,
      };

      if (selectedProveedor) {
        await updateProveedor(selectedProveedor.id, proveedorData as IProveedorUpdate);
        showMessage("Proveedor actualizado exitosamente", "success");
      } else {
        await createProveedor(proveedorData as IProveedorCreate);
        showMessage("Proveedor creado exitosamente", "success");
      }

      await fetchProveedores();
      handleClose();
    } catch (error) {
      console.error("Error al guardar proveedor:", error);
      const errorMessage = error.response?.data?.error || "Error al guardar el proveedor";
      showMessage(errorMessage, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const proveedor = proveedores.find(p => p.id === id);
    if (!proveedor) return;

    confirmDialog(
      `¿Estás seguro de que deseas eliminar el proveedor "${proveedor.nombre}"?`,
      async () => {
        try {
          await deleteProveedor(id);
          showMessage("Proveedor eliminado exitosamente", "success");
          await fetchProveedores();
        } catch (error) {
          console.error("Error al eliminar proveedor:", error);
          const errorMessage = error.response?.data?.error || "Error al eliminar el proveedor";
          showMessage(errorMessage, "error");
        }
      }
    );
  };

  const handleEdit = (proveedor: IProveedor) => {
    setSelectedProveedor(proveedor);
    setNombre(proveedor.nombre);
    setDescripcion(proveedor.descripcion || "");
    setDireccion(proveedor.direccion || "");
    setTelefono(proveedor.telefono || "");
    setOpen(true);
  };

  const resetForm = () => {
    setSelectedProveedor(null);
    setNombre("");
    setDescripcion("");
    setDireccion("");
    setTelefono("");
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const filteredProveedores = proveedores.filter(proveedor =>
    proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (proveedor.descripcion && proveedor.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Cálculos para estadísticas
  const totalProveedores = proveedores.length;
  const proveedoresConTelefono = proveedores.filter(p => p.telefono).length;
  const proveedoresConDireccion = proveedores.filter(p => p.direccion).length;
  const proveedoresCompletos = proveedores.filter(p => p.descripcion && p.telefono && p.direccion).length;

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Proveedores' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar proveedores">
        <IconButton onClick={fetchProveedores} disabled={loading} size="small">
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
        onClick={() => setOpen(true)}
        size="small"
      >
        {isMobile ? "Agregar" : "Agregar Proveedor"}
      </Button>
    </Stack>
  );

  return (
    <PageContainer
      title="Proveedores"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
    >
      {/* Estadísticas */}
      <Box sx={{ mb: 3 }}>
        <Collapse in={!isMobile || statsExpanded}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {totalProveedores}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Proveedores
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {proveedoresConTelefono}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Con Teléfono
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="info.main" fontWeight="bold">
                    {proveedoresConDireccion}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Con Dirección
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {proveedoresCompletos}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Información Completa
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Collapse>
      </Box>

      {/* Contenido principal */}
      <ContentCard
        title="Lista de Proveedores"
        subtitle={`${filteredProveedores.length} proveedor${filteredProveedores.length !== 1 ? 'es' : ''} encontrado${filteredProveedores.length !== 1 ? 's' : ''}`}
        headerActions={
          <TextField
            size="small"
            placeholder="Buscar proveedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />
        }
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredProveedores.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <LocalShipping sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchTerm ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda' 
                : 'Comienza agregando tu primer proveedor'
              }
            </Typography>
            {!searchTerm && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setOpen(true)}
              >
                Agregar Proveedor
              </Button>
            )}
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {filteredProveedores.map((proveedor) => (
                <Card 
                  key={proveedor.id}
                  onClick={() => handleEdit(proveedor)}
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
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                            {proveedor.nombre}
                          </Typography>
                          {proveedor.descripcion && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              {proveedor.descripcion}
                            </Typography>
                          )}
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(proveedor.id);
                          }}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {proveedor.telefono && (
                          <Chip
                            icon={<Phone fontSize="small" />}
                            label={proveedor.telefono}
                            size="small"
                            variant="outlined"
                            color="success"
                            sx={{ fontSize: '0.6875rem', height: 20 }}
                          />
                        )}
                        {proveedor.direccion && (
                          <Chip
                            icon={<LocationOn fontSize="small" />}
                            label={proveedor.direccion}
                            size="small"
                            variant="outlined"
                            color="info"
                            sx={{ fontSize: '0.6875rem', height: 20 }}
                          />
                        )}
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
                  <TableCell>Teléfono</TableCell>
                  <TableCell>Dirección</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProveedores.map((proveedor) => (
                  <TableRow 
                    key={proveedor.id}
                    onClick={() => handleEdit(proveedor)}
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
                        {proveedor.nombre}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {proveedor.descripcion || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {proveedor.telefono ? (
                        <Chip
                          icon={<Phone fontSize="small" />}
                          label={proveedor.telefono}
                          size="small"
                          variant="outlined"
                          color="success"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {proveedor.direccion ? (
                        <Chip
                          icon={<LocationOn fontSize="small" />}
                          label={proveedor.direccion}
                          size="small"
                          variant="outlined"
                          color="info"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Editar proveedor">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(proveedor);
                            }}
                            size="small"
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar proveedor">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(proveedor.id);
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

      {/* Dialog para crear/editar proveedor */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField 
              fullWidth 
              label="Nombre del proveedor" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Distribuidora ABC, Proveedor XYZ..."
              disabled={saving}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Business fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField 
              fullWidth 
              label="Descripción" 
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional del proveedor..."
              disabled={saving}
              multiline
              rows={2}
            />

            <TextField 
              fullWidth 
              label="Teléfono" 
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: +1234567890"
              disabled={saving}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Phone fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField 
              fullWidth 
              label="Dirección" 
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección del proveedor..."
              disabled={saving}
              multiline
              rows={2}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationOn fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary" disabled={saving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            color="primary"
            disabled={!nombre.trim() || saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </PageContainer>
  );
} 