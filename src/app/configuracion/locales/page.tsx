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
  Select,
  MenuItem,
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
  FormControl,
  InputLabel,
  Collapse,
  Alert,
  Paper,
} from "@mui/material";
import { 
  Delete, 
  Edit, 
  Add,
  Store,
  Person,
  Business,
  Group,
  Search,
  Refresh,
  ExpandMore,
  ExpandLess,
  Warehouse,
  Security,
  PersonAdd,
  Close
} from "@mui/icons-material";
import axios from "axios";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import LimitDialog from "@/components/LimitDialog";
import { ILocal, TipoLocal } from "@/types/ILocal";
import { IRol } from "@/types/IRol";
import { getLocales } from "@/services/localesService";
import { getRoles } from "@/services/rolService";

interface IUsuarioRol {
  usuarioId: string;
  rolId?: string;
}

export default function Locales() {
  const [locales, setLocales] = useState<ILocal[]>([]);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState<IRol[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedLocal, setSelectedLocal] = useState(null);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<string>(TipoLocal.TIENDA);
  const [usuariosRoles, setUsuariosRoles] = useState<IUsuarioRol[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [limitDialog, setLimitDialog] = useState(false);
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchLocales();
    fetchUsuarios();
    fetchRoles();
  }, []);

  const fetchLocales = async () => {
    setLoading(true);
    try {
      const locales = await getLocales();
      setLocales(locales);
    } catch (error) {
      console.error("Error al cargar locales:", error);
      showMessage("Error al cargar los locales", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const response = await axios.get("/api/usuarios");
      setUsuarios(response.data);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      showMessage("Error al cargar los usuarios", "error");
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await getRoles();
      setRoles(response);
    } catch (error) {
      console.error("Error al cargar roles:", error);
      showMessage("Error al cargar los roles", "error");
    }
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      showMessage("El nombre del local es obligatorio", "warning");
      return;
    }

    setSaving(true);
    try {
      if (selectedLocal) {
        await axios.put(`/api/locales/${selectedLocal.id}`, {
          nombre,
          tipo,
          usuariosRoles: usuariosRoles
        });
        showMessage("Local actualizado exitosamente", "success");
      } else {
        await axios.post("/api/locales", {
          nombre,
          tipo,
          usuariosRoles: usuariosRoles
        });
        showMessage("Local creado exitosamente", "success");
      }
      fetchLocales();
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error al guardar local:", error);
      
      // Manejar específicamente el error de límite de locales
      if (error.response?.status === 400 && 
          error.response?.data?.error?.includes("Limite de locales")) {
        setLimitDialog(true);
      } else {
        showMessage(
          error.response?.data?.error || "Error al guardar el local", 
          "error"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    confirmDialog(
      "¿Está seguro que desea eliminar este local?",
      async () => {
        try {
          await axios.delete(`/api/locales/${id}`);
          fetchLocales();
          showMessage("Local eliminado exitosamente", "success");
        } catch (error) {
          console.error("Error al eliminar local:", error);
          showMessage(
            error.response?.data?.error || "Error al eliminar el local", 
            "error"
          );
        }
      }
    );
  };

  const handleEdit = (local) => {
    setSelectedLocal(local);
    setNombre(local.nombre);
    setTipo(local.tipo || TipoLocal.TIENDA);
    
    // Usar usuariosTiendas si está disponible, sino usar usuarios para compatibilidad
    if (local.usuariosTiendas) {
      setUsuariosRoles(local.usuariosTiendas.map(ut => ({ 
        usuarioId: ut.usuario.id, 
        rolId: ut.rol?.id 
      })));
    } else {
      // Fallback para compatibilidad con datos antiguos
      setUsuariosRoles(local.usuarios.map(u => ({ usuarioId: u.id, rolId: undefined })));
    }
    
    setOpen(true);
  };

  const resetForm = () => {
    setSelectedLocal(null);
    setNombre("");
    setTipo(TipoLocal.TIENDA);
    setUsuariosRoles([]);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const handleCloseLimitDialog = () => {
    setLimitDialog(false);
  };

  const filteredLocales = locales.filter(local =>
    local.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos para estadísticas
  const totalLocales = locales.length;
  const totalUsuariosAsignados = [...new Set(locales.flatMap(t => t.usuarios.map(u => u.id)))].length;
  const localesConUsuarios = locales.filter(t => t.usuarios.length > 0).length;
  const localesSinUsuarios = locales.filter(t => t.usuarios.length === 0).length;

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Locales' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar locales">
        <IconButton onClick={fetchLocales} disabled={loading} size="small">
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
        {isMobile ? "Agregar" : "Agregar Local"}
      </Button>
    </Stack>
  );

  // Función para obtener el icono según el tipo
  const getTipoIcon = (tipoLocal: string) => {
    return tipoLocal === TipoLocal.ALMACEN ? <Warehouse fontSize="small" /> : <Store fontSize="small" />;
  };

  // Función para obtener el color según el tipo
  const getTipoColor = (tipoLocal: string) => {
    return tipoLocal === TipoLocal.ALMACEN ? "info" : "primary";
  };

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
          Cargando locales...
        </Typography>
      </Box>
    );
  }

  return (
    <PageContainer 
      title="Gestión de Locales" 
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
    >
      {/* Estadísticas */}
      <Collapse in={!isMobile || statsExpanded}>
        <Grid container spacing={isMobile ? 1.5 : 3} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<Business />}
              value={totalLocales.toString()}
              label="Total Locales"
              color="primary.main"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<Group />}
              value={totalUsuariosAsignados.toString()}
              label="Usuarios Únicos"
              color="success.main"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<Store />}
              value={localesConUsuarios.toString()}
              label="Con Usuarios"
              color="info.main"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<Person />}
              value={localesSinUsuarios.toString()}
              label="Sin Usuarios"
              color="warning.main"
            />
          </Grid>
        </Grid>
      </Collapse>

      <ContentCard
        title={`Locales (${filteredLocales.length})`}
        headerActions={
          <TextField
            size="small"
            placeholder="Buscar locales..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
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
        {filteredLocales.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {searchTerm ? 'No se encontraron locales' : 'No hay locales registradas'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza creando tu primera locales para gestionar tu negocio'}
              </Typography>
              {!searchTerm && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setOpen(true)}
                  sx={{ mt: 2 }}
                >
                  Crear Primer Local
                </Button>
              )}
            </Alert>
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards más densos
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {filteredLocales.map((local) => (
                <Card 
                  key={local.id}
                  onClick={() => handleEdit(local)}
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
                        <Box display="flex" alignItems="center" gap={1} sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                            {local.nombre}
                          </Typography>
                          <Chip 
                            icon={getTipoIcon(local.tipo)}
                            label={local.tipo}
                            size="small"
                            color={getTipoColor(local.tipo)}
                            variant="outlined"
                            sx={{ fontSize: '0.6875rem', height: 20 }}
                          />
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(local.id);
                          }}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {local.usuariosTiendas && local.usuariosTiendas.length > 0 ? (
                          local.usuariosTiendas.map((usuarioTienda) => (
                            <Chip 
                              key={usuarioTienda.usuario.id}
                              label={`${usuarioTienda.usuario.nombre}${usuarioTienda.rol ? ` (${usuarioTienda.rol.nombre})` : ''}`}
                              size="small"
                              variant="outlined"
                              icon={usuarioTienda.rol ? <Security fontSize="small" /> : <Person fontSize="small" />}
                              sx={{ fontSize: '0.6875rem', height: 24 }}
                            />
                          ))
                        ) : local.usuarios && local.usuarios.length > 0 ? (
                          // Fallback para compatibilidad
                          local.usuarios.map((user) => (
                            <Chip 
                              key={user.id}
                              label={user.nombre}
                              size="small"
                              variant="outlined"
                              icon={<Person fontSize="small" />}
                              sx={{ fontSize: '0.6875rem', height: 24 }}
                            />
                          ))
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                            Sin usuarios asignados
                          </Typography>
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
                  <TableCell>Tipo</TableCell>
                  <TableCell>Usuarios</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLocales.map((local) => (
                  <TableRow 
                    key={local.id}
                    onClick={() => handleEdit(local)}
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
                        {local.nombre}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        icon={getTipoIcon(local.tipo)}
                        label={local.tipo}
                        size="small"
                        color={getTipoColor(local.tipo)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {local.usuariosTiendas && local.usuariosTiendas.length > 0 ? (
                          local.usuariosTiendas.map((usuarioTienda) => (
                            <Chip 
                              key={usuarioTienda.usuario.id}
                              label={`${usuarioTienda.usuario.nombre}${usuarioTienda.rol ? ` (${usuarioTienda.rol.nombre})` : ''}`}
                              size="small"
                              variant="outlined"
                              icon={usuarioTienda.rol ? <Security fontSize="small" /> : <Person fontSize="small" />}
                            />
                          ))
                        ) : local.usuarios && local.usuarios.length > 0 ? (
                          // Fallback para compatibilidad
                          local.usuarios.map((user) => (
                            <Chip 
                              key={user.id}
                              label={user.nombre}
                              size="small"
                              variant="outlined"
                              icon={<Person fontSize="small" />}
                            />
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Sin usuarios asignados
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Editar local">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(local);
                            }}
                            size="small"
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar local">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(local.id);
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

      {/* Dialog para crear/editar local */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedLocal ? "Editar Local" : "Nuevo Local"}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField 
              fullWidth 
              label="Nombre del local" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Local Centro, Sucursal Norte..."
              disabled={saving}
            />

            <FormControl fullWidth disabled={saving}>
              <InputLabel>Tipo de local</InputLabel>
              <Select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as string)}
                label="Tipo de local"
              >
                <MenuItem value={TipoLocal.TIENDA}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Store fontSize="small" />
                    Tienda
                  </Box>
                </MenuItem>
                <MenuItem value={TipoLocal.ALMACEN}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Warehouse fontSize="small" />
                    Almacén
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={saving}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Usuarios y Roles Asignados
              </Typography>
              
              {/* Lista de usuarios asignados con roles */}
              {usuariosRoles.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Stack spacing={1}>
                    {usuariosRoles.map((usuarioRol, index) => {
                      const usuario = usuarios.find(u => u.id === usuarioRol.usuarioId);
                      // const rol = roles.find(r => r.id === usuarioRol.rolId);
                      
                      if (!usuario) return null;
                      
                      return (
                        <Box 
                          key={usuario.id} 
                          display="flex" 
                          alignItems="center" 
                          gap={2}
                          sx={{ 
                            p: 1, 
                            border: '1px solid', 
                            borderColor: 'divider', 
                            borderRadius: 1,
                            bgcolor: 'background.paper'
                          }}
                        >
                          <Person fontSize="small" color="primary" />
                          
                          <Box flex={1}>
                            <Typography variant="body2" fontWeight="medium">
                              {usuario.nombre}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {usuario.usuario}
                            </Typography>
                          </Box>
                          
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Rol</InputLabel>
                            <Select
                              value={usuarioRol.rolId || ''}
                              onChange={(e) => {
                                const newUsuariosRoles = [...usuariosRoles];
                                newUsuariosRoles[index].rolId = e.target.value || undefined;
                                setUsuariosRoles(newUsuariosRoles);
                              }}
                              label="Rol"
                            >
                              <MenuItem value="">
                                <em>Sin rol específico</em>
                              </MenuItem>
                              {roles.map((rol) => (
                                <MenuItem key={rol.id} value={rol.id}>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Security fontSize="small" />
                                    {rol.nombre}
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          
                          <Tooltip title="Remover usuario">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => {
                                setUsuariosRoles(usuariosRoles.filter((_, i) => i !== index));
                              }}
                            >
                              <Close fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              )}
              
              {/* Selector para agregar nuevos usuarios */}
              <FormControl fullWidth>
                <Select
                  value=""
                  onChange={(e) => {
                    const userId = e.target.value as string;
                    if (userId && !usuariosRoles.some(ur => ur.usuarioId === userId)) {
                      setUsuariosRoles([...usuariosRoles, { usuarioId: userId, rolId: undefined }]);
                    }
                  }}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Seleccionar usuario para agregar...</em>
                  </MenuItem>
                  {usuarios
                    .filter(u => !usuariosRoles.some(ur => ur.usuarioId === u.id))
                    .map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PersonAdd fontSize="small" />
                          {user.nombre} ({user.rol})
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              
              {usuariosRoles.length === 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  No hay usuarios asignados a este local. Agregue al menos un usuario.
                </Alert>
              )}
            </FormControl>
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

      {/* Dialog de límite de localess alcanzado */}
      <LimitDialog
        open={limitDialog}
        onClose={handleCloseLimitDialog}
        limitType="locales"
      />

      {ConfirmDialogComponent}
    </PageContainer>
  );
} 