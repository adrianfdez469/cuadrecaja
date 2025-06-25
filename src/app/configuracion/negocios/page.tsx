"use client";

import { useEffect, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from "@mui/material";
import { Delete, Edit, Add, Business, Store, Person, Inventory, AttachMoney, Search } from "@mui/icons-material";
import { planesNegocio } from "@/utils/planesNegocio";
import { createNegocio, getNegocios, updateNegocio, deleteNegocio } from "@/services/negocioServce";
import { useMessageContext } from "@/context/MessageContext";
import { INegocio } from "@/types/INegocio";

const planesNegocioArr = Object.entries(planesNegocio);

export default function Negocios() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedNegocio, setSelectedNegocio] = useState<INegocio | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
        await updateNegocio(
          selectedNegocio.id,
          nombre, 
          selectedPlan.limiteLocales, 
          selectedPlan.limiteUsuarios,
          selectedPlan.limiteProductos
        );
        showMessage('Negocio actualizado satisfactoriamente', 'success');
      } else {
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
    } catch (error) {
      console.log(error);
      const errorMessage = (error).response?.data?.error || 'Ocurrió un error al eliminar el negocio';
      showMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (negocio: INegocio) => {
    setSelectedNegocio(negocio);
    setNombre(negocio.nombre);
    
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

  const getDaysRemaining = (limitTime: Date): number => {
    const now = new Date();
    const limit = new Date(limitTime);
    const diffTime = limit.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPlanColor = (planName: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning'> = {
      'FREEMIUM': 'default',
      'BASICO': 'primary',
      'SILVER': 'secondary',
      'PREMIUM': 'success',
      'CUSTOM': 'warning'
    };
    return colors[planName] || 'default';
  };

  const filteredNegocios = negocios.filter((negocio) => {
    const searchLower = searchTerm.toLowerCase();
    const planName = getPlanName(negocio.locallimit, negocio.userlimit, negocio.productlimit);
    
    return negocio.nombre.toLowerCase().includes(searchLower) ||
           planName.toLowerCase().includes(searchLower);
  });

  if (loading && negocios.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Negocios
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpen(true)}
        >
          Agregar Negocio
        </Button>
      </Box>

      <Box mb={2}>
        <TextField
          placeholder="Buscar negocio..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          sx={{ minWidth: 300 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Negocio</TableCell>
              <TableCell align="center">Plan</TableCell>
              <TableCell align="center">Límites</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredNegocios.map((negocio) => {
              const days = getDaysRemaining(negocio.limitTime);
              const planName = getPlanName(negocio.locallimit, negocio.userlimit, negocio.productlimit);
              const planData = planesNegocio[planName as keyof typeof planesNegocio];
              
              return (
                <TableRow key={negocio.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Business color="primary" />
                      <Typography variant="body2" fontWeight="medium">
                        {negocio.nombre}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={planName}
                      size="small"
                      color={getPlanColor(planName)}
                      variant="filled"
                    />
                    {planData && planData.precio > 0 && (
                      <Typography variant="caption" display="block" color="success.main">
                        ${planData.precio}/mes
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Stack spacing={0.5} alignItems="center">
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Store fontSize="small" color="primary" />
                        <Typography variant="body2">{negocio.locallimit}</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Person fontSize="small" color="secondary" />
                        <Typography variant="body2">
                          {negocio.userlimit === -1 ? '∞' : negocio.userlimit}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Inventory fontSize="small" color="info" />
                        <Typography variant="body2">
                          {negocio.productlimit === -1 ? '∞' : negocio.productlimit}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={days > 0 ? `${days} días` : 'Expirado'}
                      size="small"
                      color={days <= 0 ? 'error' : days <= 7 ? 'warning' : 'success'}
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="Editar negocio">
                        <IconButton
                          onClick={() => handleEdit(negocio)}
                          size="small"
                          color="primary"
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar negocio">
                        <IconButton
                          onClick={() => handleDelete(negocio)}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredNegocios.length === 0 && !loading && (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="text.secondary">
            {searchTerm ? 'No se encontraron negocios' : 'No hay negocios registrados'}
          </Typography>
        </Box>
      )}

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
