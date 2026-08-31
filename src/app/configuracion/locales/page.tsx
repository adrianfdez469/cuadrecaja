"use client";

import React, { useState, useEffect } from "react";
import { StatStrip } from "@/components/StatStrip";
import { touch } from "@/theme";
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
  Stack,
  Tooltip,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Alert,
  Paper,
} from "@mui/material";
import {
  Delete,
  Edit,
  Add,
  Store,
  Person,
  Search,
  Refresh,
  Warehouse,
  Security,
  PersonAdd,
  Close,
} from "@mui/icons-material";
import { PageContainer } from "@/components/PageContainer";
import { LoadingState } from "@/components/LoadingState";
import { ContentCard } from "@/components/ContentCard";
import SelectableTextField from "@/components/SelectableTextField";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import LimitDialog from "@/components/LimitDialog";
import { ILocal, TipoLocal } from "@/schemas/tienda";
import { IRol } from "@/schemas/rol";
import {
  getLocales,
  createLocal,
  updateLocal,
  deleteLocal,
} from "@/services/localesService";
import { getRoles } from "@/services/rolService";
import { getUsuarios } from "@/services/usuarioService";
import { TipoLocalPill } from "./components/TipoLocalPill";
import { UsuariosLabel } from "./components/UsuariosLabel";
import { LocalCard } from "./components/LocalCard";

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
  const [limitDialog, setLimitDialog] = useState(false);
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
      const data = await getUsuarios();
      setUsuarios(data);
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
      const payload = { nombre, tipo, usuariosRoles };
      if (selectedLocal) {
        await updateLocal(selectedLocal.id, payload);
        showMessage("Local actualizado exitosamente", "success");
      } else {
        await createLocal(payload);
        showMessage("Local creado exitosamente", "success");
      }
      fetchLocales();
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error al guardar local:", error);

      // Manejar específicamente el error de límite de locales
      if (
        error.response?.status === 400 &&
        error.response?.data?.error?.includes("Limite de locales")
      ) {
        setLimitDialog(true);
      } else {
        showMessage(
          error.response?.data?.error || "Error al guardar el local",
          "error",
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
          await deleteLocal(id);
          fetchLocales();
          showMessage("Local eliminado exitosamente", "success");
        } catch (error) {
          console.error("Error al eliminar local:", error);
          showMessage(
            error.response?.data?.error || "Error al eliminar el local",
            "error",
          );
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const handleEdit = (local) => {
    setSelectedLocal(local);
    setNombre(local.nombre);
    setTipo(local.tipo || TipoLocal.TIENDA);

    // Usar usuariosTiendas si está disponible, sino usar usuarios para compatibilidad
    if (local.usuariosTiendas) {
      setUsuariosRoles(
        local.usuariosTiendas.map((ut) => ({
          usuarioId: ut.usuario.id,
          rolId: ut.rol?.id,
        })),
      );
    } else {
      // Fallback para compatibilidad con datos antiguos
      setUsuariosRoles(
        local.usuarios.map((u) => ({ usuarioId: u.id, rolId: undefined })),
      );
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

  const filteredLocales = locales.filter((local) =>
    local.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Cálculos para estadísticas
  const totalLocales = locales.length;
  const totalUsuariosAsignados = [
    ...new Set(locales.flatMap((t) => t.usuarios.map((u) => u.id))),
  ].length;
  const localesConUsuarios = locales.filter(
    (t) => t.usuarios.length > 0,
  ).length;
  const localesSinUsuarios = locales.filter(
    (t) => t.usuarios.length === 0,
  ).length;

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Locales" },
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar locales">
        <IconButton onClick={fetchLocales} disabled={loading}>
          <Refresh />
        </IconButton>
      </Tooltip>
      {!isMobile && (
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpen(true)}
        >
          Agregar Local
        </Button>
      )}
    </Stack>
  );

  // Componente de estadística móvil optimizado
  if (loading) {
    return (
      <PageContainer title="Gestión de Locales" breadcrumbs={breadcrumbs}>
        <LoadingState variant="table" />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Gestión de Locales"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
    >
      {isMobile && (
        <Button
          variant="contained"
          startIcon={<Add />}
          fullWidth
          onClick={() => setOpen(true)}
          sx={{ minHeight: touch.comfortable, mb: 2.5 }}
        >
          Agregar
        </Button>
      )}

      <StatStrip
        stats={[
          { label: "Total Locales", value: totalLocales },
          { label: "Usuarios Únicos", value: totalUsuariosAsignados },
          { label: "Con Usuarios", value: localesConUsuarios },
          { label: "Sin Usuarios", value: localesSinUsuarios },
        ]}
      />

      {(() => {
        const emptyState = (
          <Alert severity="info" sx={{ mt: isMobile ? 0 : 2 }}>
            <Typography variant="h6" gutterBottom>
              {searchTerm
                ? "No se encontraron locales"
                : "No hay locales registradas"}
            </Typography>
            <Typography variant="body1" gutterBottom>
              {searchTerm
                ? "Intenta con otros términos de búsqueda"
                : "Comienza creando tu primera locales para gestionar tu negocio"}
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
        );

        const searchField = (
          <SelectableTextField
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
              maxWidth: isMobile ? 200 : "none",
            }}
          />
        );

        // En mobile, ni la lista de cards ni la búsqueda viven dentro de un
        // `ContentCard` — cada local ya es su propia caja (mismo criterio
        // que `roles`/`gastos/plantillas`: sin tarjeta dentro de tarjeta).
        if (isMobile) {
          return (
            <>
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ mb: 1.5, fontSize: "1.1875rem" }}
              >
                Locales ({filteredLocales.length})
              </Typography>
              <SelectableTextField
                size="small"
                fullWidth
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
                sx={{ mb: 2 }}
              />
              {filteredLocales.length === 0 ? (
                emptyState
              ) : (
                <Stack spacing={1.5}>
                  {filteredLocales.map((local) => (
                    <LocalCard
                      key={local.id}
                      local={local}
                      onEdit={() => handleEdit(local)}
                      onDelete={() => handleDelete(local.id)}
                    />
                  ))}
                </Stack>
              )}
            </>
          );
        }

        return (
          <ContentCard
            title={`Locales (${filteredLocales.length})`}
            headerActions={searchField}
            noPadding
            fullHeight
          >
            {filteredLocales.length === 0 ? (
              <Box sx={{ p: 2 }}>{emptyState}</Box>
            ) : (
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
                          cursor: "pointer",
                          "&:hover": {
                            backgroundColor: "semantic.surface.sunken",
                          },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {local.nombre}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <TipoLocalPill tipo={local.tipo} />
                        </TableCell>
                        <TableCell>
                          <UsuariosLabel local={local} />
                        </TableCell>
                        <TableCell align="center">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="center"
                          >
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
        );
      })()}

      {/* Dialog para crear/editar local */}
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
          {selectedLocal ? "Editar Local" : "Nuevo Local"}
          {isMobile && (
            <IconButton onClick={handleClose} disabled={saving}>
              <Close />
            </IconButton>
          )}
        </DialogTitle>
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
                      const usuario = usuarios.find(
                        (u) => u.id === usuarioRol.usuarioId,
                      );
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
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            bgcolor: "background.paper",
                          }}
                        >
                          <Person fontSize="small" color="primary" />

                          <Box flex={1}>
                            <Typography variant="body2" fontWeight="medium">
                              {usuario.nombre}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {usuario.usuario}
                            </Typography>
                          </Box>

                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Rol</InputLabel>
                            <Select
                              value={usuarioRol.rolId || ""}
                              onChange={(e) => {
                                const newUsuariosRoles = [...usuariosRoles];
                                newUsuariosRoles[index].rolId =
                                  e.target.value || undefined;
                                setUsuariosRoles(newUsuariosRoles);
                              }}
                              label="Rol"
                            >
                              <MenuItem value="">
                                <em>Sin rol específico</em>
                              </MenuItem>
                              {roles.map((rol) => (
                                <MenuItem key={rol.id} value={rol.id}>
                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    gap={1}
                                  >
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
                                setUsuariosRoles(
                                  usuariosRoles.filter((_, i) => i !== index),
                                );
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
                    if (
                      userId &&
                      !usuariosRoles.some((ur) => ur.usuarioId === userId)
                    ) {
                      setUsuariosRoles([
                        ...usuariosRoles,
                        { usuarioId: userId, rolId: undefined },
                      ]);
                    }
                  }}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Seleccionar usuario para agregar...</em>
                  </MenuItem>
                  {usuarios
                    .filter(
                      (u) => !usuariosRoles.some((ur) => ur.usuarioId === u.id),
                    )
                    .map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PersonAdd fontSize="small" />
                          {user.nombre}
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {usuariosRoles.length === 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  No hay usuarios asignados a este local. Agregue al menos un
                  usuario.
                </Alert>
              )}
            </FormControl>
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
            disabled={!nombre.trim() || saving}
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: isMobile ? 56 : undefined }}
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
