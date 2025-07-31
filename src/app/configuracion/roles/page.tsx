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
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  SelectChangeEvent,
  Grid,
  Card,
  CardContent,
  Divider,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Delete,
  Edit,
  Add,
  Security,
  InfoOutlined,
} from "@mui/icons-material";
import { useMessageContext } from "@/context/MessageContext";
import { useAppContext } from "@/context/AppContext";
import { IRol, ICreateRol, IUpdateRol, IPermiso } from "@/types/IRol";
import { getRoles, createRol, updateRol, deleteRol } from "@/services/rolService";
import axios from "axios";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";

interface PermisosData {
  [key: string]: IPermiso;
}

export default function RolesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [roles, setRoles] = useState<IRol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedRol, setSelectedRol] = useState<IRol | null>(null);
  const [permisos, setPermisos] = useState<PermisosData>({});
  const [permisosLoading, setPermisosLoading] = useState(false);
  
  const { showMessage } = useMessageContext();
  const { user, loadingContext } = useAppContext();

  // Estados del formulario
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<string[]>([]);

  const fetchRoles = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getRoles();
      setRoles(data);
    } catch (error) {
      console.error(error);
      setError('Error al cargar los roles');
      showMessage('Error al cargar los roles', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermisos = async () => {
    setPermisosLoading(true);
    try {
      const response = await axios.get('/api/permisos');
      setPermisos(response.data);
    } catch (error) {
      console.error("Error al cargar permisos:", error);
      showMessage('Error al cargar los permisos del sistema', 'error');
    } finally {
      setPermisosLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingContext && user) {
      fetchRoles();
      fetchPermisos();
    }
  }, [user, loadingContext]);

  const handleOpenDialog = (rol?: IRol) => {
    if (rol) {
      setSelectedRol(rol);
      setNombre(rol.nombre);
      setDescripcion(rol.descripcion || "");
      setPermisosSeleccionados(rol.permisos ? rol.permisos.split("|") : []);
    } else {
      setSelectedRol(null);
      setNombre("");
      setDescripcion("");
      setPermisosSeleccionados([]);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setSelectedRol(null);
    setNombre("");
    setDescripcion("");
    setPermisosSeleccionados([]);
  };

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      showMessage('El nombre del rol es requerido', 'error');
      return;
    }

    if (permisosSeleccionados.length === 0) {
      showMessage('Debe seleccionar al menos un permiso', 'error');
      return;
    }

    const permisosString = permisosSeleccionados.join("|");

    try {
      if (selectedRol) {
        // Actualizar rol existente
        const rolData: IUpdateRol = {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          permisos: permisosString
        };
        await updateRol(selectedRol.id, rolData);
        showMessage('Rol actualizado correctamente', 'success');
      } else {
        // Crear nuevo rol
        const rolData: ICreateRol = {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          permisos: permisosString
        };
        await createRol(rolData);
        showMessage('Rol creado correctamente', 'success');
      }
      
      handleCloseDialog();
      fetchRoles();
    } catch (error) {
      console.error('Error al guardar rol:', error);
      const errorMessage = error.response?.data?.error || 'Error al guardar el rol';
      showMessage(errorMessage, 'error');
    }
  };

  const handleDelete = async (rol: IRol) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el rol "${rol.nombre}"?`)) {
      try {
        await deleteRol(rol.id);
        showMessage('Rol eliminado correctamente', 'success');
        fetchRoles();
      } catch (error) {
        console.error('Error al eliminar rol:', error);
        const errorMessage = error.response?.data?.error || 'Error al eliminar el rol';
        showMessage(errorMessage, 'error');
      }
    }
  };

  const handlePermisosChange = (event: SelectChangeEvent<typeof permisosSeleccionados>) => {
    const value = event.target.value;
    setPermisosSeleccionados(typeof value === 'string' ? value.split(',') : value);
  };

  const groupPermissions = (permisosData: PermisosData) => {
    const grouped: { [key: string]: { [key: string]: IPermiso } } = {};
    
    Object.keys(permisosData).forEach(key => {
      const parts = key.split('.');
      const moduleGroup = parts[0];
      
      if (!grouped[moduleGroup]) {
        grouped[moduleGroup] = {};
      }
      
      grouped[moduleGroup][key] = permisosData[key];
    });
    
    return grouped;
  };

  const getModuleDisplayName = (moduleName: string) => {
    const moduleNames: { [key: string]: string } = {
      'pos': 'Punto de Venta',
      'movimientos': 'Movimientos',
      'configuracion': 'Configuración',
      'reportes': 'Reportes'
    };
    return moduleNames[moduleName] || moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  };

  if (loadingContext) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageContainer title="Gestión de Roles">
      <ContentCard>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" gutterBottom>
            Gestión de Roles
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Nuevo Rol
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell>Permisos</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No hay roles configurados
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((rol) => (
                    <TableRow key={rol.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Security fontSize="small" color="primary" />
                          <Typography variant="body2" fontWeight="medium">
                            {rol.nombre}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {rol.descripcion || 'Sin descripción'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {rol.permisos.split("|").slice(0, 3).map((permiso) => (
                            <Chip
                              key={permiso}
                              label={permiso}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                          {rol.permisos.split("|").length > 3 && (
                            <Chip
                              label={`+${rol.permisos.split("|").length - 3} más`}
                              size="small"
                              variant="outlined"
                              color="default"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(rol)}
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(rol)}
                            color="error"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Dialog para crear/editar rol */}
        <Dialog 
          open={open} 
          onClose={handleCloseDialog}
          maxWidth="md" 
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            {selectedRol ? 'Editar Rol' : 'Nuevo Rol'}
          </DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={3} pt={1}>
              <TextField
                label="Nombre del Rol"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                fullWidth
                required
                placeholder="Ej: Vendedor, Administrador"
              />
              
              <TextField
                label="Descripción"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Descripción opcional del rol..."
              />

              <FormControl fullWidth>
                <InputLabel>Permisos</InputLabel>
                <Select
                  multiple
                  value={permisosSeleccionados}
                  onChange={handlePermisosChange}
                  input={<OutlinedInput label="Permisos" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                  disabled={permisosLoading}
                >
                  {permisosLoading ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} />
                      <Typography sx={{ ml: 1 }}>Cargando permisos...</Typography>
                    </MenuItem>
                  ) : (
                    Object.entries(groupPermissions(permisos)).map(([module, modulePermisos]) => [
                      <MenuItem key={`header-${module}`} disabled sx={{ fontWeight: 'bold' }}>
                        <Typography variant="subtitle2" color="primary">
                          {getModuleDisplayName(module)}
                        </Typography>
                      </MenuItem>,
                      ...Object.entries(modulePermisos).map(([permisoKey, permisoData]) => (
                        <MenuItem key={permisoKey} value={permisoKey}>
                          <Checkbox checked={permisosSeleccionados.indexOf(permisoKey) > -1} />
                          <ListItemText 
                            primary={permisoKey}
                            secondary={permisoData.descripcion}
                            sx={{ ml: 1 }}
                          />
                        </MenuItem>
                      ))
                    ]).flat()
                  )}
                </Select>
              </FormControl>

              {permisosSeleccionados.length > 0 && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Permisos seleccionados ({permisosSeleccionados.length})
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={1}>
                      {permisosSeleccionados.map((permiso) => (
                        <Grid item xs={12} sm={6} md={4} key={permiso}>
                          <Tooltip title={permisos[permiso]?.descripcion || ''}>
                            <Chip
                              label={permiso}
                              size="small"
                              color="primary"
                              variant="outlined"
                              deleteIcon={<InfoOutlined />}
                              sx={{ width: '100%' }}
                            />
                          </Tooltip>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained"
              disabled={!nombre.trim() || permisosSeleccionados.length === 0}
            >
              {selectedRol ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </Dialog>
      </ContentCard>
    </PageContainer>
  );
} 