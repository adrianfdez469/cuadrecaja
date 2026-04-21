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
  Search,
  Refresh,
  ExpandMore,
  ExpandLess,
  MailOutline,
  LockReset,
} from "@mui/icons-material";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import LimitDialog from "@/components/LimitDialog";
import { useMessageContext } from "@/context/MessageContext";
import { usePermisos } from "@/utils/permisos_front";
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  reenviarInvitacionUsuario,
  resetearPasswordUsuario,
} from "@/services/usuarioService";
import type { IUsuarioListItem } from "@/schemas/usuario";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDIENTE_VERIFICACION = "PENDIENTE_VERIFICACION" as const;

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<IUsuarioListItem[]>([]);
  const [resetPasswordSent, setResetPasswordSent] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<IUsuarioListItem | null>(null);
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [limitDialog, setLimitDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { showMessage } = useMessageContext();
  const { verificarPermiso } = usePermisos();
  const canManageUsers = verificarPermiso("configuracion.usuarios.acceder");
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const data = await getUsuarios();
      setUsuarios(data);
      setResetPasswordSent((prev) => {
        const next: Record<string, boolean> = {};
        data.forEach((user) => {
          if (prev[user.id]) {
            next[user.id] = true;
          }
        });
        return next;
      });
    } catch (error) {
      console.error("Error al obtener los usuarios", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (user: IUsuarioListItem | null = null) => {
    setSelectedUsuario(user);
    setNombre(user?.nombre || "");
    setUsuario(user?.usuario || "");
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedUsuario(null);
  };

  const handleDelete = async (id: string) => {
    confirmDialog("¿Estás seguro de eliminar este usuario?", async () => {
      try {
        await deleteUsuario(id);
        showMessage("Usuario eliminado", "success");
        fetchUsuarios();
      } catch (error: unknown) {
        console.error("Error al eliminar el usuario", error);
        const msg =
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error ===
            "string"
            ? (error as { response: { data: { error: string } } }).response.data.error
            : "Error al eliminar el usuario";
        showMessage(msg, "error");
      }
    });
  };

  const handleReinvite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await reenviarInvitacionUsuario(id);
      showMessage("Invitación reenviada", "success");
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error ===
          "string"
          ? (error as { response: { data: { error: string } } }).response.data.error
          : "No se pudo reenviar la invitación";
      showMessage(msg, "error");
    }
  };

  const handleSave = async () => {
    if (!nombre.trim() || !usuario.trim()) {
      showMessage("Nombre y correo son obligatorios", "warning");
      return;
    }

    const emailNormalizado = usuario.trim().toLowerCase();
    if (!EMAIL_REGEX.test(emailNormalizado)) {
      showMessage("El campo usuario debe ser un correo electrónico válido.", "warning");
      return;
    }

    const data: { nombre: string; usuario: string } = {
      nombre: nombre.trim(),
      usuario: emailNormalizado,
    };

    setSaving(true);
    try {
      if (selectedUsuario) {
        await updateUsuario(selectedUsuario.id, data);
        const emailCambiado =
          selectedUsuario.usuario.trim().toLowerCase() !== emailNormalizado;
        showMessage(
          emailCambiado
            ? "Datos guardados. Se envió un correo de activación para confirmar el nuevo email."
            : "Usuario actualizado exitosamente",
          "success"
        );
      } else {
        await createUsuario(data);
        showMessage(
          "Usuario creado. Se envió una invitación por correo para que defina su contraseña.",
          "success"
        );
      }
      fetchUsuarios();
      handleClose();
    } catch (error: unknown) {
      console.error("Error al guardar el usuario", error);
      const err = error as { response?: { status?: number; data?: { error?: string } } };
      if (
        err.response?.status === 400 &&
        err.response?.data?.error?.includes("Limite de usuarios exedido")
      ) {
        setLimitDialog(true);
      } else {
        showMessage(err.response?.data?.error || "Error al guardar el usuario", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.MouseEvent, user: IUsuarioListItem) => {
    e.stopPropagation();
    confirmDialog(
      `Se enviará un correo de restablecimiento a ${user.usuario}. ¿Deseas continuar?`,
      async () => {
        try {
          await resetearPasswordUsuario(user.id);
          setResetPasswordSent((prev) => ({ ...prev, [user.id]: true }));
          showMessage("Correo de restablecimiento enviado", "success");
        } catch (error: unknown) {
          const msg =
            typeof error === "object" &&
            error !== null &&
            "response" in error &&
            typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error ===
              "string"
              ? (error as { response: { data: { error: string } } }).response.data.error
              : "No se pudo enviar el restablecimiento";
          showMessage(msg, "error");
        }
      }
    );
  };

  const handleCloseLimitDialog = () => {
    setLimitDialog(false);
  };

  const filteredUsuarios = usuarios.filter(
    (user) =>
      user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.usuario.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cálculos para estadísticas
  const totalUsuarios = usuarios.length;

  const breadcrumbs = [
    { label: 'Inicio', href: '/home' },
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
      {canManageUsers ? (
        <Button
          variant="contained"
          startIcon={!isMobile ? <Add /> : undefined}
          onClick={() => handleOpen()}
          size="small"
        >
          {isMobile ? "Agregar" : "Agregar Usuario"}
        </Button>
      ) : null}
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
              {/* <Grid item xs={4}>
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
              </Grid> */}
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
          {/* <Grid item xs={12} sm={6} md={4}>
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
          </Grid> */}
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
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {user.estadoCuenta === PENDIENTE_VERIFICACION ? (
                            <Chip label="Pendiente" color="warning" size="small" sx={{ height: 20 }} />
                          ) : null}
                          {user.rol === "SUPER_ADMIN" ? (
                            <Chip label={user.rol} color="info" size="small" sx={{ height: 20 }} />
                          ) : null}
                          {resetPasswordSent[user.id] ? (
                            <Chip label="Reset enviado" color="info" size="small" sx={{ height: 20 }} />
                          ) : null}
                        </Stack>
                      </Box>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                          Usuario: {user.usuario}
                        </Typography>
                        {user.estadoCuenta === PENDIENTE_VERIFICACION &&
                        verificarPermiso("configuracion.usuarios.acceder") ? (
                          <IconButton
                            onClick={(e) => handleReinvite(e, user.id)}
                            size="small"
                            color="primary"
                            title="Reenviar invitación"
                          >
                            <MailOutline fontSize="small" />
                          </IconButton>
                        ) : null}
                        {canManageUsers && user.estadoCuenta !== PENDIENTE_VERIFICACION ? (
                          <IconButton
                            onClick={(e) => handleResetPassword(e, user)}
                            size="small"
                            color="primary"
                            title="Enviar restablecimiento de contraseña"
                          >
                            <LockReset fontSize="small" />
                          </IconButton>
                        ) : null}
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(user.id);
                          }}
                          size="small"
                          color="error"
                          disabled={!verificarPermiso('configuracion.usuarios.deleteOrDisable')}
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
                  <TableCell>Estado</TableCell>
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
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-start">
                        {user.estadoCuenta === PENDIENTE_VERIFICACION ? (
                          <Chip label="Pendiente" color="warning" size="small" />
                        ) : (
                          <Chip label="Activo" color="success" size="small" variant="outlined" />
                        )}
                        {resetPasswordSent[user.id] ? (
                          <Chip label="Reset enviado" color="info" size="small" variant="outlined" />
                        ) : null}
                      </Stack>
                    </TableCell>

                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {user.estadoCuenta === PENDIENTE_VERIFICACION &&
                        verificarPermiso("configuracion.usuarios.acceder") ? (
                          <Tooltip title="Reenviar invitación">
                            <IconButton
                              onClick={(e) => handleReinvite(e, user.id)}
                              size="small"
                              color="primary"
                            >
                              <MailOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {canManageUsers && user.estadoCuenta !== PENDIENTE_VERIFICACION ? (
                          <Tooltip title="Enviar restablecimiento de contraseña">
                            <IconButton
                              onClick={(e) => handleResetPassword(e, user)}
                              size="small"
                              color="primary"
                            >
                              <LockReset fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
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
                        <Tooltip title={"Eliminar usuario"}>
                          <span>
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(user.id);
                              }}
                              size="small"
                              color="error"
                              disabled={!verificarPermiso('configuracion.usuarios.deleteOrDisable')}
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
        <DialogTitle>
          {selectedUsuario ? "Editar usuario" : "Invitar usuario"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {!selectedUsuario ? (
              <Typography variant="body2" color="text.secondary">
                Se enviará un correo con un enlace para que la persona defina su contraseña y active
                su cuenta (válido varias horas).
              </Typography>
            ) : null}

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
              type="email"
              label="Correo electrónico (usuario)" 
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              placeholder="ejemplo@correo.com"
            />

            {selectedUsuario ? (
              <Typography variant="caption" color="text.secondary">
                La contraseña se gestiona por flujo de restablecimiento enviado por correo.
              </Typography>
            ) : null}
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
            disabled={
              !nombre.trim() ||
              !usuario.trim() ||
              !EMAIL_REGEX.test(usuario.trim().toLowerCase()) ||
              saving
            }
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
