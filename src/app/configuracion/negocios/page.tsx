"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Select,
  MenuItem,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
  Divider
} from "@mui/material";
import { Delete, Edit, Add, Business, Schedule, Store, Person, Inventory, AttachMoney, ChangeCircle } from "@mui/icons-material";
import { planesNegocio } from "@/utils/planesNegocio";
import { createNegocio, getNegocios, updateNegocio, deleteNegocio } from "@/services/negocioServce";
import { useMessageContext } from "@/context/MessageContext";
import { INegocio } from "@/types/INegocio";
import { DataTable, DataTableColumn, DataTableAction } from "@/components/DataTable";
import { formatDate, formatNumber } from "@/components/DataTable/utils/formatters";

const planesNegocioArr = Object.entries(planesNegocio);

export default function Negocios() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedNegocio, setSelectedNegocio] = useState<INegocio | null>(null);
  const { showMessage } = useMessageContext();

  const [nombre, setNombre] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<{
    limiteLocales: number;
    limiteUsuarios: number;
    limiteProductos: number;
    precio: number;
    descripcion: string;
  }>();

  useEffect(() => {
    fetchNegocios();
  }, []);

  const fetchNegocios = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNegocios();
      setNegocios(data);
    } catch (error) {
      console.log(error);
      setError('Error al cargar los negocios');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPlan) return;
    
    setLoading(true);
    try {
      if (selectedNegocio) {
        // Editar negocio existente
        await updateNegocio(
          selectedNegocio.id,
          nombre, 
          selectedPlan.limiteLocales, 
          selectedPlan.limiteUsuarios,
          selectedPlan.limiteProductos
        );
        showMessage('Negocio actualizado satisfactoriamente', 'success');
      } else {
        // Crear nuevo negocio
        await createNegocio(
          nombre, 
          selectedPlan.limiteLocales, 
          selectedPlan.limiteUsuarios,
          selectedPlan.limiteProductos
        );
        showMessage('Negocio creado satisfactoriamente', 'success');
      }
      
      await fetchNegocios();
      handleCloseDialog();
    } catch (error) {
      console.log(error);
      showMessage(`Ocurrió un error al ${selectedNegocio ? 'actualizar' : 'crear'} el negocio`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (negocio: INegocio) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el negocio "${negocio.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await deleteNegocio(negocio.id);
      showMessage('Negocio eliminado satisfactoriamente', 'success');
      await fetchNegocios();
    } catch (error: any) {
      console.log(error);
      const errorMessage = error.response?.data?.error || 'Ocurrió un error al eliminar el negocio';
      showMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (negocio: INegocio) => {
    setSelectedNegocio(negocio);
    setNombre(negocio.nombre);
    
    // Encontrar el plan correspondiente basado en los límites del negocio
    const planKey = Object.keys(planesNegocio).find(key => {
      const plan = planesNegocio[key as keyof typeof planesNegocio];
      return plan.limiteLocales === negocio.locallimit &&
             plan.limiteUsuarios === negocio.userlimit &&
             plan.limiteProductos === negocio.productlimit;
    });
    
    if (planKey) {
      setSelectedPlan(planesNegocio[planKey as keyof typeof planesNegocio]);
    }
    
    setOpen(true);
  };

  const handleView = (negocio: INegocio) => {
    console.log('Ver detalles del negocio:', negocio);
  };

  const handleSetSelectedPlan = (planKey: string) => {
    setSelectedPlan(planesNegocio[planKey as keyof typeof planesNegocio]);
  };

  const handleCloseDialog = () => {
    setNombre('');
    setSelectedNegocio(null);
    setSelectedPlan(undefined);
    setOpen(false);
  };

  const getPlanName = (locallimit: number, userlimit: number, productlimit: number): string => {
    const planEntry = Object.entries(planesNegocio).find(
      ([, plan]) => plan.limiteLocales === locallimit && 
                   plan.limiteUsuarios === userlimit &&
                   plan.limiteProductos === productlimit
    );
    return planEntry ? planEntry[0] : 'CUSTOM';
  };

  // Función para calcular días restantes
  const getDaysRemaining = (limitTime: Date): number => {
    const now = new Date();
    const limit = new Date(limitTime);
    const diffTime = limit.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Configuración de columnas optimizada para móviles
  const columns: DataTableColumn<INegocio>[] = useMemo(() => [
    {
      id: 'nombre',
      label: 'Negocio',
      minWidth: isMobile ? 160 : 200,
      responsive: 'always',
      sortable: true,
      format: (value, row) => (
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Business color="primary" fontSize="small" />
            <Typography variant="body2" fontWeight="medium" noWrap>
              {value}
            </Typography>
          </Box>
          {isMobile && (
            <Box>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <Schedule fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {(() => {
                    const days = getDaysRemaining(row.limitTime);
                    return days > 0 ? `${days} días restantes` : 'Expirado';
                  })()}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )
    },
    {
      id: 'diasRestantes',
      label: 'Días Restantes',
      minWidth: 120,
      align: 'center',
      responsive: 'desktop',
      sortable: true,
      format: (_, row) => {
        const days = getDaysRemaining(row.limitTime);
        let color: 'success' | 'warning' | 'error' = 'success';
        
        if (days <= 0) color = 'error';
        else if (days <= 7) color = 'warning';
        
        return (
          <Chip
            label={days > 0 ? `${days} días` : 'Expirado'}
            size="small"
            variant="filled"
            color={color}
            sx={{ fontWeight: 'medium' }}
          />
        );
      }
    },
    {
      id: 'limits',
      label: 'Límites',
      minWidth: isMobile ? 140 : 180,
      align: 'center',
      responsive: 'always',
      sortable: false,
      format: (_, row) => (
        <Box>
          <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mb={0.5}>
            <Store fontSize="small" color="primary" />
            <Typography variant="body2" fontWeight="medium" color="primary.main">
              {formatNumber(row.locallimit)}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mb={0.5}>
            <Person fontSize="small" color="secondary" />
            <Typography variant="body2" fontWeight="medium" color="secondary.main">
              {row.userlimit === -1 ? '∞' : formatNumber(row.userlimit)}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
            <Inventory fontSize="small" color="info" />
            <Typography variant="body2" fontWeight="medium" color="info.main">
              {row.productlimit === -1 ? '∞' : formatNumber(row.productlimit)}
            </Typography>
          </Box>
          {isMobile && (
            <Box mt={0.5}>
              {(() => {
                const planName = getPlanName(row.locallimit, row.userlimit, row.productlimit);
                const planColors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning'> = {
                  'FREEMIUM': 'default',
                  'BASICO': 'primary',
                  'SILVER': 'secondary', 
                  'PREMIUM': 'success',
                  'CUSTOM': 'warning'
                };
                
                return (
                  <Chip
                    label={planName}
                    size="small"
                    color={planColors[planName] || 'default'}
                    variant="filled"
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                );
              })()}
            </Box>
          )}
        </Box>
      )
    },
    {
      id: 'plan',
      label: 'Plan',
      minWidth: 100,
      align: 'center',
      responsive: 'desktop',
      sortable: false,
      format: (_, row) => {
        const planName = getPlanName(row.locallimit, row.userlimit, row.productlimit);
        const planColors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning'> = {
          'FREEMIUM': 'default',
          'BASICO': 'primary',
          'SILVER': 'secondary',
          'PREMIUM': 'success',
          'CUSTOM': 'warning'
        };
        
        const planData = planesNegocio[planName as keyof typeof planesNegocio];
        
        return (
          <Box textAlign="center">
            <Chip
              label={planName}
              size="small"
              color={planColors[planName] || 'default'}
              variant="filled"
              sx={{ mb: 0.5 }}
            />
            {planData && planData.precio > 0 && (
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                <AttachMoney color="success" />
                <Typography variant="caption" color="success.main" fontWeight="medium">
                  ${planData.precio}
                </Typography>
              </Box>
            )}
          </Box>
        );
      }
    }
  ], [isMobile]);

  // Configuración de acciones optimizada
  const actions: DataTableAction<INegocio>[] = useMemo(() => [
    {
      icon: <Edit />,
      label: 'Editar negocio',
      onClick: handleEdit,
      color: 'primary'
    },
    {
      icon: <Delete />,
      label: 'Eliminar negocio', 
      onClick: handleDelete,
      color: 'error'
    }
  ], []);

  // Toolbar integrado que se posicionará mejor
  const customToolbar = (
    <Box display="flex" justifyContent="flex-end" mb={0}>
      <Button
        variant="contained"
        startIcon={!isMobile ? <Add /> : undefined}
        onClick={() => setOpen(true)}
        size={isMobile ? "small" : "medium"}
        sx={{ 
          borderRadius: 2,
          minWidth: isMobile ? 'auto' : 140,
          px: isMobile ? 1.5 : 2,
          flexShrink: 0
        }}
      >
        {isMobile ? <Add /> : 'Agregar'}
      </Button>
    </Box>
  );

  return (
    <Box p={isMobile ? 0 : 1}>
      <DataTable<INegocio>
        data={negocios}
        columns={columns}
        actions={actions}
        loading={loading}
        error={error}
        title={isMobile ? "Negocios" : "Gestión de Negocios"}
        searchable={true}
        sortable={true}
        pagination={true}
        pageSize={isMobile ? 5 : 10}
        pageSizeOptions={isMobile ? [5, 10] : [5, 10, 25]}
        onRefresh={fetchNegocios}
        emptyMessage="No hay negocios registrados"
        customToolbar={customToolbar}
        rowKey="id"
        onRowClick={handleView}
        dense={isMobile}
        stickyHeader={true}
        maxHeight={isMobile ? 'calc(100vh - 150px)' : 600}
      />

      {/* Dialog optimizado para móviles */}
      <Dialog 
        open={open} 
        onClose={handleCloseDialog} 
        fullWidth 
        maxWidth="sm"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
            m: isMobile ? 0 : 2
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Business />
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={600}>
              {selectedNegocio ? "Editar Negocio" : "Agregar Negocio"}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: isMobile ? 1.5 : 3, py: isMobile ? 1 : 2 }}>
          <Stack spacing={isMobile ? 2 : 3} sx={{ mt: 0.5 }}>
            <TextField
              label="Nombre del Negocio"
              fullWidth
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ingresa el nombre del negocio"
              required
              size={isMobile ? "small" : "medium"}
            />
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Plan de Suscripción
              </Typography>
              <Select
                fullWidth
                value={selectedPlan ? Object.keys(planesNegocio).find(
                  key => planesNegocio[key as keyof typeof planesNegocio] === selectedPlan
                ) : ''}
                onChange={(e) => handleSetSelectedPlan(e.target.value as string)}
                displayEmpty
                size={isMobile ? "small" : "medium"}
              >
                <MenuItem value="" disabled>
                  Selecciona un plan
                </MenuItem>
                {planesNegocioArr.map(([planKey, planData]) => (
                  <MenuItem key={planKey} value={planKey}>
                    <Box>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography variant="body2" fontWeight="medium">
                          {planKey}
                        </Typography>
                        {planData.precio > 0 && (
                          <Chip
                            label={`$${planData.precio} USD`}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                        {planData.precio === 0 && (
                          <Chip
                            label="GRATIS"
                            size="small"
                            color="default"
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {planData.limiteLocales} tiendas • {planData.limiteUsuarios === -1 ? '∞' : planData.limiteUsuarios} usuarios • {planData.limiteProductos === -1 ? '∞' : planData.limiteProductos} productos
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {planData.descripcion}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {selectedPlan && (
              <Box 
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'grey.200'
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Detalles del Plan Seleccionado
                </Typography>
                <Stack 
                  direction={isMobile ? "column" : "row"} 
                  spacing={isMobile ? 2 : 3}
                  alignItems="center"
                >
                  <Box textAlign="center" display="flex" alignItems="center" gap={1}>
                    <Store color="primary" />
                    <Box>
                      <Typography variant="h6" color="primary.main">
                        {selectedPlan.limiteLocales}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tiendas
                      </Typography>
                    </Box>
                  </Box>
                  <Box textAlign="center" display="flex" alignItems="center" gap={1}>
                    <Person color="secondary" />
                    <Box>
                      <Typography variant="h6" color="secondary.main">
                        {selectedPlan.limiteUsuarios === -1 ? '∞' : selectedPlan.limiteUsuarios}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Usuarios
                      </Typography>
                    </Box>
                  </Box>
                  <Box textAlign="center" display="flex" alignItems="center" gap={1}>
                    <Inventory color="info" />
                    <Box>
                      <Typography variant="h6" color="info.main">
                        {selectedPlan.limiteProductos === -1 ? '∞' : selectedPlan.limiteProductos}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Productos
                      </Typography>
                    </Box>
                  </Box>
                  {selectedPlan.precio > 0 && (
                    <Box textAlign="center" display="flex" alignItems="center" gap={1}>
                      <AttachMoney color="success" />
                      <Box>
                        <Typography variant="h6" color="success.main">
                          ${selectedPlan.precio}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          USD/mes
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ 
          p: isMobile ? 1.5 : 3, 
          pt: isMobile ? 1 : 2,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 1 : 0
        }}>
          <Button 
            onClick={handleCloseDialog} 
            variant="outlined"
            fullWidth={isMobile}
          >
            Cancelar
          </Button>
          <Button 
            disabled={!nombre.trim() || !selectedPlan || loading} 
            variant="contained" 
            onClick={handleSave}
            fullWidth={isMobile}
          >
            {loading 
              ? (selectedNegocio ? 'Actualizando...' : 'Creando...') 
              : (selectedNegocio ? 'Actualizar' : 'Crear')
            }
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
