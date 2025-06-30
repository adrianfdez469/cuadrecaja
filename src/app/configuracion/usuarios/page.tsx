"use client"

import React, { useEffect, useState } from "react";
import { 
  Typography, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
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
  Edit, 
  Delete, 
  Add,
  Person,
  AdminPanelSettings,
  Store,
  Search,
  Refresh,
  ExpandMore,
  ExpandLess
} from "@mui/icons-material";
import axios from "axios";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import LimitDialog from "@/components/LimitDialog";
import { useMessageContext } from "@/context/MessageContext";
import { useAppContext } from "@/context/AppContext";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("VENDEDOR");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [limitDialog, setLimitDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { showMessage } = useMessageContext();
  const { user: actualUser } = useAppContext();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/usuarios");
      setUsuarios(response.data);
    } catch (error) {
      console.error("Error al obtener los usuarios", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (user = null) => {
    setSelectedUsuario(user);
    setNombre(user?.nombre || "");
    setUsuario(user?.usuario || "");
    setPassword(user?.password || "");
    setRol(user?.rol || "VENDEDOR");
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedUsuario(null);
  };

  const handleDelete = async (id) => {
    confirmDialog("¿Estás seguro de eliminar este usuario?", async () => {
      try {
        await axios.delete(`/api/usuarios/${id}`);
        fetchUsuarios();
      } catch (error) {
        console.error("Error al eliminar el usuario", error);
      }
    });
  };

  const handleSave = async () => {
    if (!nombre.trim() || !usuario.trim() || (!selectedUsuario && !password.trim())) {
      showMessage("Todos los campos son obligatorios", "warning");
      return;
    }

    const data = {
      nombre: nombre,
      usuario: usuario,
      password: password,
      rol: rol,
    };

    setSaving(true);
    try {
      if (selectedUsuario) {
        await axios.put(`/api/usuarios/${selectedUsuario.id}`, data);
        showMessage("Usuario actualizado exitosamente", "success");
      } else {
        await axios.post("/api/usuarios", data);
        showMessage("Usuario creado exitosamente", "success");
      }
      fetchUsuarios();
      handleClose();
    } catch (error) {
      console.error("Error al guardar el usuario", error);
      
      // Manejar específicamente el error de límite de usuarios
      if (error.response?.status === 400 && 
          error.response?.data?.error?.includes("Limite de usuarios exedido")) {
        setLimitDialog(true);
      } else {
        showMessage(
          error.response?.data?.error || "Error al guardar el usuario", 
          "error"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCloseLimitDialog = () => {
    setLimitDialog(false);
  };

  const filteredUsuarios = usuarios.filter((user) =>
    user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.usuario.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos para estadísticas
  const totalUsuarios = usuarios.length;
  const adminUsuarios = usuarios.filter(u => u.rol === "ADMIN").length;
  const vendedorUsuarios = usuarios.filter(u => u.rol === "VENDEDOR").length;

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Usuarios' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar usuarios">
        <IconButton onClick={fetchUsuarios} disabled={loading} size="small">
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
        {isMobile ? "Agregar" : "Agregar Usuario"}
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
          Cargando usuarios...
        </Typography>
      </Box>
    );
  }

  return (
    <PageContainer
      title="Gestión de Usuarios"
      subtitle={!isMobile ? "Administra los usuarios del sistema" : undefined}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/* Estadísticas de usuarios */}
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Collapse in={statsExpanded}>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={4}>
                <StatCard
                  icon={<Person />}
                  value={totalUsuarios.toLocaleString()}
                  label="Total"
                  color="primary.light"
                />
              </Grid>
              <Grid item xs={4}>
                <StatCard
                  icon={<AdminPanelSettings />}
                  value={adminUsuarios.toLocaleString()}
                  label="Admins"
                  color="error.light"
                />
              </Grid>
              <Grid item xs={4}>
                <StatCard
                  icon={<Store />}
                  value={vendedorUsuarios.toLocaleString()}
                  label="Vendedores"
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
              icon={<Person />}
              value={totalUsuarios.toLocaleString()}
              label="Total Usuarios"
              color="primary.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<AdminPanelSettings />}
              value={adminUsuarios.toLocaleString()}
              label="Administradores"
              color="error.light"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              icon={<Store />}
              value={vendedorUsuarios.toLocaleString()}
              label="Vendedores"
              color="info.light"
            />
          </Grid>
        </Grid>
      )}

      {/* Lista de usuarios */}
      <ContentCard 
        title="Lista de Usuarios"
        subtitle={!isMobile ? "Haz clic en cualquier usuario para editarlo" : undefined}
        headerActions={
          <TextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar usuario..."}
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
        {filteredUsuarios.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Person sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega usuarios para comenzar a gestionar el acceso al sistema'}
              </Typography>
            </Box>
          </Box>
        ) : isMobile ? (
          // Vista móvil con cards más densos
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              {filteredUsuarios.map((user) => (
                <Card 
                  key={user.id}
                  onClick={() => handleOpen(user)}
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
                          {user.nombre}
                        </Typography>
                        <Chip 
                          label={user.rol}
                          color={user.rol === 'ADMIN' ? 'error' : 'info'}
                          size="small"
                          sx={{ height: 20 }}
                        />
                      </Box>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                          Usuario: {user.usuario}
                        </Typography>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(user.id);
                          }}
                          size="small"
                          color="error"
                          disabled={user.rol === 'ADMIN' && adminUsuarios <= 1 && actualUser.rol !== 'SUPER_ADMIN'}
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
                  <TableCell>Usuario</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsuarios.map((user) => (
                  <TableRow 
                    key={user.id}
                    onClick={() => handleOpen(user)}
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
                        {user.nombre}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.usuario}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={user.rol}
                        color={user.rol === 'ADMIN' ? 'error' : 'info'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Editar usuario">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpen(user);
                            }}
                            size="small"
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={user.rol === 'ADMIN' && adminUsuarios <= 1 ? "No se puede eliminar el último administrador" : "Eliminar usuario"}>
                          <span>
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(user.id);
                              }}
                              size="small"
                              color="error"
                              disabled={user.rol === 'ADMIN' && adminUsuarios <= 1}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </span>
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

      {/* Dialog para crear/editar usuario */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedUsuario ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField 
              fullWidth 
              label="Nombre completo" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Juan Pérez, María García..."
            />
            
            <TextField 
              fullWidth 
              label="Usuario" 
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              placeholder="Nombre de usuario para iniciar sesión"
            />

            <TextField 
              fullWidth 
              label="Contraseña" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!selectedUsuario}
              placeholder={selectedUsuario ? "Dejar vacío para mantener la actual" : "Contraseña segura"}
            />

            <FormControl fullWidth>
              <InputLabel>Rol</InputLabel>
              <Select
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                label="Rol"
              >
                <MenuItem value="ADMIN">
                  <Box display="flex" alignItems="center" gap={1}>
                    <AdminPanelSettings fontSize="small" />
                    Administrador
                  </Box>
                </MenuItem>
                <MenuItem value="VENDEDOR">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Store fontSize="small" />
                    Vendedor
                  </Box>
                </MenuItem>
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
            disabled={!nombre.trim() || !usuario.trim() || (!selectedUsuario && !password.trim()) || saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}

      {limitDialog && (
        <LimitDialog
          open={limitDialog}
          onClose={handleCloseLimitDialog}
          limitType="usuarios"
        />
      )}
    </PageContainer>
  );
}
