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
  Divider,
  FormControlLabel,
  Switch
} from "@mui/material";
import { 
  Delete, 
  Add,
  AccountBalance,
  Description,
  Star,
  Search,
  Refresh,
  ExpandLess,
  ExpandMore
} from "@mui/icons-material";
import { fetchTransferDestinations, createTransferDestination, updateTransferDestination, deleteTransferDestination } from "@/services/transferDestinationsService";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useAppContext } from "@/context/AppContext";
import { ITransferDestination } from "@/types/ITransferDestination";

export default function DestinosTransferenciaPage() {
  const [destinations, setDestinations] = useState<ITransferDestination[]>([]);
  const [open, setOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<ITransferDestination | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { user } = useAppContext();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => {
    if (user?.localActual?.id) {
      loadDestinations();
    }
  }, [user?.localActual?.id]);

  const loadDestinations = async () => {
    if (!user?.localActual?.id) return;
    
    setLoading(true);
    try {
      const data = await fetchTransferDestinations(user.localActual.id);
      setDestinations(data);
    } catch (error) {
      console.error("Error al cargar destinos de transferencia:", error);
      showMessage("Error al cargar destinos de transferencia", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (destination: ITransferDestination | null = null) => {
    setEditingDestination(destination);
    setNombre(destination ? destination.nombre : "");
    setDescripcion(destination ? destination.descripcion || "" : "");
    setIsDefault(destination ? destination.default : false);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingDestination(null);
    setNombre("");
    setDescripcion("");
    setIsDefault(false);
  };

  const handleSave = async () => {
    if (!user?.localActual?.id) {
      showMessage("No hay un local seleccionado", "error");
      return;
    }

    try {
      if (editingDestination) {
        await updateTransferDestination(editingDestination.id, nombre, descripcion, isDefault);
        showMessage('Destino de transferencia actualizado exitosamente', 'success');
      } else {
        await createTransferDestination(nombre, descripcion, isDefault, user.localActual.id);
        showMessage('Destino de transferencia creado exitosamente', 'success');
      }
      await loadDestinations();
      handleClose();
    } catch (error) {
      console.error("Error al guardar destino de transferencia:", error);
      showMessage('Error al guardar el destino de transferencia', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    confirmDialog('¿Está seguro que desea eliminar el destino de transferencia?', async () => {
      try {
        await deleteTransferDestination(id);
        showMessage('Destino de transferencia eliminado', 'success');
      } catch (error) {
        console.log(error);
        showMessage('Error al intentar eliminar el destino de transferencia. Es probable que esté en uso!', 'error');
      } finally {
        await loadDestinations();
      }
    });
  };

  const filteredDestinations = destinations.filter((destination) =>
    destination.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (destination.descripcion && destination.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Cálculos para estadísticas
  const totalDestinations = destinations.length;
  const defaultDestinations = destinations.filter(d => d.default).length;
  const destinationsWithDescription = destinations.filter(d => d.descripcion).length;
  const destinationsVisible = filteredDestinations.length;

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Destinos de Transferencia' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar destinos">
        <IconButton onClick={loadDestinations} disabled={loading} size="small">
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
        disabled={!user?.localActual?.id}
      >
        {isMobile ? "Agregar" : "Agregar Destino"}
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

  if (!user?.localActual?.id) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography variant="h6" color="text.secondary">
          Selecciona un local para gestionar los destinos de transferencia
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
          Cargando destinos de transferencia...
        </Typography>
      </Box>
    );
  }

  return (
    <PageContainer
      title="Gestión de Destinos de Transferencia"
      subtitle={!isMobile ? "Configura los destinos para las transferencias de tu local" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas */}
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Collapse in={statsExpanded}>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <StatCard
                  icon={<AccountBalance />}
                  value={totalDestinations.toLocaleString()}
                  label="Total"
                  color="primary.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Star />}
                  value={defaultDestinations.toLocaleString()}
                  label="Por Defecto"
                  color="warning.light"
                />
              </Grid>
            </Grid>
            <Divider sx={{ mb: 2 }} />
          </Collapse>
        </Box>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<AccountBalance />}
              value={totalDestinations.toLocaleString()}
              label="Total Destinos"
              color="primary.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Star />}
              value={defaultDestinations.toLocaleString()}
              label="Por Defecto"
              color="warning.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Description />}
              value={destinationsWithDescription.toLocaleString()}
              label="Con Descripción"
              color="success.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Search />}
              value={destinationsVisible.toLocaleString()}
              label="Visibles"
              color="info.light"
            />
          </Grid>
        </Grid>
      )}

      {/* Lista de destinos */}
      <ContentCard 
        title="Lista de Destinos"
        subtitle={!isMobile ? "Haz clic en cualquier destino para editarlo" : undefined}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar destino..."}
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
        {filteredDestinations.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <AccountBalance sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {searchTerm ? 'No se encontraron destinos' : 'No hay destinos registrados'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega destinos para configurar las transferencias'}
              </Typography>
            </Box>
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {filteredDestinations.map((destination) => (
                <Card 
                  key={destination.id}
                  onClick={() => handleOpen(destination)}
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
                          <AccountBalance color="primary" />
                          <Typography variant="subtitle2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                            {destination.nombre}
                          </Typography>
                          {destination.default && (
                            <Star color="warning" fontSize="small" />
                          )}
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(destination.id);
                          }}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      {destination.descripcion && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                          {destination.descripcion}
                        </Typography>
                      )}
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
                  <TableCell align="center">Por Defecto</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDestinations.map((destination) => (
                  <TableRow 
                    key={destination.id}
                    onClick={() => handleOpen(destination)}
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
                        <AccountBalance color="primary" />
                        <Typography variant="body2" fontWeight="medium">
                          {destination.nombre}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {destination.descripcion || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {destination.default ? (
                        <Chip 
                          icon={<Star />} 
                          label="Por Defecto" 
                          color="warning" 
                          size="small" 
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(destination.id);
                        }}
                        size="small"
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Modal de edición/creación */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDestination ? "Editar Destino de Transferencia" : "Nuevo Destino de Transferencia"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField 
              fullWidth 
              label="Nombre" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Tarjeta Principal, Cuenta Bancaria..."
            />
            
            <TextField 
              fullWidth 
              label="Descripción" 
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              multiline
              rows={3}
              placeholder="Descripción opcional del destino..."
            />

            <FormControlLabel
              control={
                <Switch
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  color="warning"
                />
              }
              label="Marcar como destino por defecto"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={!nombre.trim()}
          >
            {editingDestination ? "Actualizar" : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </PageContainer>
  );
} 