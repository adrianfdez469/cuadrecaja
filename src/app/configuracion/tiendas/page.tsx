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
  Divider,
  Alert
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
  ExpandLess
} from "@mui/icons-material";
import axios from "axios";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import LimitDialog from "@/components/LimitDialog";

interface IUsuario {
  id: string;
  nombre: string;
  usuario: string;
} 

interface ITienda {
  id: string;
  nombre: string;
  usuarios: IUsuario[]
}

export default function Tiendas() {
  const [tiendas, setTiendas] = useState<ITienda[]>([]);
  const [usuarios, setUsuarios] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedTienda, setSelectedTienda] = useState(null);
  const [nombre, setNombre] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
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
    fetchTiendas();
    fetchUsuarios();
  }, []);

  const fetchTiendas = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/tiendas");
      setTiendas(response.data);
    } catch (error) {
      console.error("Error al cargar tiendas:", error);
      showMessage("Error al cargar las tiendas", "error");
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

  const handleSave = async () => {
    if (!nombre.trim()) {
      showMessage("El nombre de la tienda es obligatorio", "warning");
      return;
    }

    setSaving(true);
    try {
      if (selectedTienda) {
        await axios.put(`/api/tiendas/${selectedTienda.id}`, {
          nombre,
          idusuarios: selectedUsers,
        });
        showMessage("Tienda actualizada exitosamente", "success");
      } else {
        await axios.post("/api/tiendas", {
          nombre,
          idusuarios: selectedUsers,
        });
        showMessage("Tienda creada exitosamente", "success");
      }
      fetchTiendas();
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error al guardar tienda:", error);
      
      // Manejar específicamente el error de límite de tiendas
      if (error.response?.status === 400 && 
          error.response?.data?.error?.includes("Limite de tiendas")) {
        setLimitDialog(true);
      } else {
        showMessage(
          error.response?.data?.error || "Error al guardar la tienda", 
          "error"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    confirmDialog(
      "¿Está seguro que desea eliminar esta tienda?",
      async () => {
        try {
          await axios.delete(`/api/tiendas/${id}`);
          fetchTiendas();
          showMessage("Tienda eliminada exitosamente", "success");
        } catch (error) {
          console.error("Error al eliminar tienda:", error);
          showMessage(
            error.response?.data?.error || "Error al eliminar la tienda", 
            "error"
          );
        }
      }
    );
  };

  const handleEdit = (tienda) => {
    setSelectedTienda(tienda);
    setNombre(tienda.nombre);
    setSelectedUsers(tienda.usuarios.map((u) => u.id));
    setOpen(true);
  };

  const resetForm = () => {
    setSelectedTienda(null);
    setNombre("");
    setSelectedUsers([]);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const handleCloseLimitDialog = () => {
    setLimitDialog(false);
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos para estadísticas
  const totalTiendas = tiendas.length;
  const totalUsuariosAsignados = [...new Set(tiendas.flatMap(t => t.usuarios.map(u => u.id)))].length;
  const tiendasConUsuarios = tiendas.filter(t => t.usuarios.length > 0).length;
  const tiendasSinUsuarios = tiendas.filter(t => t.usuarios.length === 0).length;

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Tiendas' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar tiendas">
        <IconButton onClick={fetchTiendas} disabled={loading} size="small">
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
        {isMobile ? "Agregar" : "Agregar Tienda"}
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
          Cargando tiendas...
        </Typography>
      </Box>
    );
  }

  return (
    <PageContainer
      title="Gestión de Tiendas"
      subtitle={!isMobile ? "Administra las tiendas y asigna usuarios" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas de tiendas */}
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Collapse in={statsExpanded}>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <StatCard
                  icon={<Store />}
                  value={totalTiendas.toLocaleString()}
                  label="Total"
                  color="primary.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Person />}
                  value={totalUsuariosAsignados.toLocaleString()}
                  label="Usuarios"
                  color="success.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Group />}
                  value={tiendasConUsuarios.toLocaleString()}
                  label="Con Usuarios"
                  color="info.light"
                />
              </Grid>
              <Grid item xs={6}>
                <StatCard
                  icon={<Business />}
                  value={tiendasSinUsuarios.toLocaleString()}
                  label="Sin Usuarios"
                  color="warning.light"
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
              icon={<Store />}
              value={totalTiendas.toLocaleString()}
              label="Total Tiendas"
              color="primary.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<Person />}
              value={totalUsuariosAsignados.toLocaleString()}
              label="Usuarios Asignados"
              color="success.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<Group />}
              value={tiendasConUsuarios.toLocaleString()}
              label="Con Usuarios"
              color="info.light"
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={<Business />}
              value={tiendasSinUsuarios.toLocaleString()}
              label="Sin Usuarios"
              color="warning.light"
            />
          </Grid>
        </Grid>
      )}

      {/* Lista de tiendas */}
      <ContentCard 
        title="Lista de Tiendas"
        subtitle={!isMobile ? "Haz clic en cualquier tienda para editarla" : undefined}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar tienda..."}
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
        {filteredTiendas.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {searchTerm ? 'No se encontraron tiendas' : 'No hay tiendas registradas'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza creando tu primera tienda para gestionar tu negocio'}
              </Typography>
              {!searchTerm && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setOpen(true)}
                  sx={{ mt: 2 }}
                >
                  Crear Primera Tienda
                </Button>
              )}
            </Alert>
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards más densos
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {filteredTiendas.map((tienda) => (
                <Card 
                  key={tienda.id}
                  onClick={() => handleEdit(tienda)}
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
                        <Typography variant="subtitle2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                          {tienda.nombre}
                        </Typography>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tienda.id);
                          }}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {tienda.usuarios.length > 0 ? (
                          tienda.usuarios.map((user) => (
                            <Chip 
                              key={user.id}
                              label={user.nombre}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.6875rem', height: 20 }}
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
                  <TableCell>Usuarios</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTiendas.map((tienda) => (
                  <TableRow 
                    key={tienda.id}
                    onClick={() => handleEdit(tienda)}
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
                        {tienda.nombre}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {tienda.usuarios.length > 0 ? (
                          tienda.usuarios.map((user) => (
                            <Chip 
                              key={user.id}
                              label={user.nombre}
                              size="small"
                              variant="outlined"
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
                        <Tooltip title="Editar tienda">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(tienda);
                            }}
                            size="small"
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar tienda">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(tienda.id);
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

      {/* Dialog para crear/editar tienda */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedTienda ? "Editar Tienda" : "Nueva Tienda"}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField 
              fullWidth 
              label="Nombre de la tienda" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Tienda Centro, Sucursal Norte..."
              disabled={saving}
            />

            <FormControl fullWidth disabled={saving}>
              <InputLabel>Usuarios asignados</InputLabel>
              <Select
                multiple
                value={selectedUsers}
                onChange={(e) => setSelectedUsers(e.target.value as string[])}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((userId) => {
                      const usuario = usuarios.find(u => u.id === userId);
                      return usuario ? (
                        <Chip key={userId} label={usuario.nombre} size="small" />
                      ) : null;
                    })}
                  </Box>
                )}
                label="Usuarios asignados"
              >
                {usuarios.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Person fontSize="small" />
                      {user.nombre} ({user.rol})
                    </Box>
                  </MenuItem>
                ))}
              </Select>
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

      {/* Dialog de límite de tiendas alcanzado */}
      <LimitDialog
        open={limitDialog}
        onClose={handleCloseLimitDialog}
        limitType="tiendas"
      />

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
