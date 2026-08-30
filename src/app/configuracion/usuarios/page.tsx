"use client";

import React, { useEffect, useState } from "react";
import { StatStrip } from "@/components/StatStrip";
import { StatusPill } from "@/components/StatusPill";
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
  Stack,
  Tooltip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Edit,
  Delete,
  Add,
  Person,
  Search,
  Refresh,
  MailOutline,
  LockReset,
  Close,
} from "@mui/icons-material";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { LoadingState } from "@/components/LoadingState";
import { ContentCard } from "@/components/ContentCard";
import SelectableTextField from "@/components/SelectableTextField";
import LimitDialog from "@/components/LimitDialog";
import { useMessageContext } from "@/context/MessageContext";
import { usePermisos } from "@/utils/permisos_front";
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getUsuarioDeleteInfo,
  reenviarInvitacionUsuario,
  resetearPasswordUsuario,
} from "@/services/usuarioService";
import type { IUsuarioDeleteInfo, IUsuarioListItem } from "@/schemas/usuario";
import DeleteUsuarioDialog from "@/components/usuarios/DeleteUsuarioDialog";
import { UsuarioCard } from "@/components/usuarios/UsuarioCard";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDIENTE_VERIFICACION = "PENDIENTE_VERIFICACION" as const;

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<IUsuarioListItem[]>([]);
  const [resetPasswordSent, setResetPasswordSent] = useState<
    Record<string, boolean>
  >({});
  const [open, setOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] =
    useState<IUsuarioListItem | null>(null);
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [limitDialog, setLimitDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<IUsuarioDeleteInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { showMessage } = useMessageContext();
  const { verificarPermiso } = usePermisos();
  const canManageUsers = verificarPermiso("configuracion.usuarios.acceder");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
    setDeleteLoading(true);
    try {
      const info = await getUsuarioDeleteInfo(id);
      setDeleteInfo(info);
      setDeleteDialogOpen(true);
    } catch (e) {
      showMessage("Error al obtener información del usuario", "error");
      console.error("Error al eliminar el usuario", e);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteInfo) return;
    try {
      await deleteUsuario(deleteInfo.id);
      showMessage("Usuario eliminado", "success");
      setDeleteDialogOpen(false);
      setDeleteInfo(null);
      fetchUsuarios();
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response
          ?.data?.error === "string"
          ? (error as { response: { data: { error: string } } }).response.data
              .error
          : "Error al eliminar el usuario";
      showMessage(msg, "error");
    }
  };

  const handleReinvite = async (
    e: React.MouseEvent | undefined,
    id: string,
  ) => {
    e?.stopPropagation();
    try {
      await reenviarInvitacionUsuario(id);
      showMessage("Invitación reenviada", "success");
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response
          ?.data?.error === "string"
          ? (error as { response: { data: { error: string } } }).response.data
              .error
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
      showMessage(
        "El campo usuario debe ser un correo electrónico válido.",
        "warning",
      );
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
          "success",
        );
      } else {
        await createUsuario(data);
        showMessage(
          "Usuario creado. Se envió una invitación por correo para que defina su contraseña.",
          "success",
        );
      }
      fetchUsuarios();
      handleClose();
    } catch (error: unknown) {
      console.error("Error al guardar el usuario", error);
      const err = error as {
        response?: { status?: number; data?: { error?: string } };
      };
      if (
        err.response?.status === 400 &&
        err.response?.data?.error?.includes("Limite de usuarios exedido")
      ) {
        setLimitDialog(true);
      } else {
        showMessage(
          err.response?.data?.error || "Error al guardar el usuario",
          "error",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (
    e: React.MouseEvent | undefined,
    user: IUsuarioListItem,
  ) => {
    e?.stopPropagation();
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
            typeof (error as { response?: { data?: { error?: string } } })
              .response?.data?.error === "string"
              ? (error as { response: { data: { error: string } } }).response
                  .data.error
              : "No se pudo enviar el restablecimiento";
          showMessage(msg, "error");
        }
      },
    );
  };

  const handleCloseLimitDialog = () => {
    setLimitDialog(false);
  };

  const filteredUsuarios = usuarios.filter(
    (user) =>
      user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.usuario.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Cálculos para estadísticas
  const totalUsuarios = usuarios.length;

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Usuarios" },
  ];

  const agregarUsuarioButton = canManageUsers && (
    <Button
      variant="contained"
      startIcon={<Add />}
      onClick={() => handleOpen()}
      fullWidth={isMobile}
      sx={isMobile ? { minHeight: 52 } : undefined}
    >
      Agregar Usuario
    </Button>
  );

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar usuarios">
        <IconButton onClick={fetchUsuarios} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      {!isMobile && agregarUsuarioButton}
    </Stack>
  );

  // Componente de estadística móvil optimizado
  if (loading) {
    return (
      <PageContainer
        title="Gestión de Usuarios"
        breadcrumbs={breadcrumbs}
        maxWidth="xl"
      >
        <LoadingState variant="table" />
      </PageContainer>
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
      {isMobile && <Box sx={{ mb: 2 }}>{agregarUsuarioButton}</Box>}

      <StatStrip
        stats={[
          { label: "Total Usuarios", value: totalUsuarios.toLocaleString() },
        ]}
      />

      {/* Lista de usuarios */}
      {(() => {
        const emptyState = (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Person sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {searchTerm
                ? "No se encontraron usuarios"
                : "No hay usuarios registrados"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm
                ? "Intenta con otros términos de búsqueda"
                : "Agrega usuarios para comenzar a gestionar el acceso al sistema"}
            </Typography>
          </Box>
        );

        // En mobile, ni la lista ni la búsqueda viven dentro de un
        // `ContentCard` — cada usuario ya es su propia caja (mismo criterio
        // que `locales`/`roles`: sin tarjeta dentro de tarjeta).
        if (isMobile) {
          return (
            <>
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ mb: 1.5, fontSize: "1.1875rem" }}
              >
                Lista de Usuarios
              </Typography>
              <SelectableTextField
                size="small"
                fullWidth
                placeholder="Buscar usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              {filteredUsuarios.length === 0 ? (
                emptyState
              ) : (
                <Stack spacing={1.5}>
                  {filteredUsuarios.map((user) => (
                    <UsuarioCard
                      key={user.id}
                      usuario={user}
                      canManage={canManageUsers}
                      canReinvite={verificarPermiso(
                        "configuracion.usuarios.acceder",
                      )}
                      resetPasswordSent={!!resetPasswordSent[user.id]}
                      deleteDisabled={
                        !verificarPermiso(
                          "configuracion.usuarios.deleteOrDisable",
                        ) || deleteLoading
                      }
                      onEdit={() => handleOpen(user)}
                      onDelete={() => handleDelete(user.id)}
                      onReinvite={() => handleReinvite(undefined, user.id)}
                      onResetPassword={() =>
                        handleResetPassword(undefined, user)
                      }
                    />
                  ))}
                </Stack>
              )}
            </>
          );
        }

        return (
          <ContentCard
            title="Lista de Usuarios"
            subtitle="Haz clic en cualquier usuario para editarlo"
            headerActions={
              <SelectableTextField
                size="small"
                placeholder="Buscar usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 250 }}
              />
            }
            noPadding
            fullHeight
          >
            {filteredUsuarios.length === 0 ? (
              <Box sx={{ p: 2 }}>{emptyState}</Box>
            ) : (
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
                          cursor: "pointer",
                          "&:hover": {
                            backgroundColor: "action.hover",
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
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                            justifyContent="flex-start"
                          >
                            {user.estadoCuenta === PENDIENTE_VERIFICACION ? (
                              <StatusPill label="Pendiente" hue="caution" />
                            ) : (
                              <StatusPill label="Activo" hue="positive" />
                            )}
                            {resetPasswordSent[user.id] ? (
                              <StatusPill label="Reset enviado" hue="info" />
                            ) : null}
                          </Stack>
                        </TableCell>

                        <TableCell align="center">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="center"
                          >
                            {user.estadoCuenta === PENDIENTE_VERIFICACION &&
                            verificarPermiso(
                              "configuracion.usuarios.acceder",
                            ) ? (
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
                            {canManageUsers &&
                            user.estadoCuenta !== PENDIENTE_VERIFICACION ? (
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
                                  disabled={
                                    !verificarPermiso(
                                      "configuracion.usuarios.deleteOrDisable",
                                    ) || deleteLoading
                                  }
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
        );
      })()}

      {/* Dialog para crear/editar usuario */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {selectedUsuario ? "Editar usuario" : "Invitar usuario"}
          {isMobile && (
            <IconButton onClick={handleClose} disabled={saving}>
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {!selectedUsuario ? (
              <Typography variant="body2" color="text.secondary">
                Se enviará un correo con un enlace para que la persona defina su
                contraseña y active su cuenta (válido varias horas).
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
                La contraseña se gestiona por flujo de restablecimiento enviado
                por correo.
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: isMobile ? "column-reverse" : "row",
            alignItems: "stretch",
          }}
        >
          <Button
            onClick={handleClose}
            color="secondary"
            disabled={saving}
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
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
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: isMobile ? 56 : undefined }}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <DeleteUsuarioDialog
        open={deleteDialogOpen}
        info={deleteInfo}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteInfo(null);
        }}
        onConfirm={handleConfirmDelete}
      />

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
