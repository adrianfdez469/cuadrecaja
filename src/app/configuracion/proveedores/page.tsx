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
  CircularProgress,
  InputAdornment,
  Stack,
  Tooltip,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
} from "@mui/material";
import {
  Delete,
  Edit,
  Add,
  Business,
  Phone,
  LocationOn,
  Search,
  Refresh,
  LocalShipping,
  PersonOff,
  Close,
} from "@mui/icons-material";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { StatStrip } from "@/components/StatStrip";
import SelectableTextField from "@/components/SelectableTextField";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import {
  getProveedores,
  createProveedor,
  updateProveedor,
  deleteProveedor,
} from "@/services/proveedorService";
import {
  IProveedor,
  IProveedorCreate,
  IProveedorUpdate,
} from "@/schemas/proveedor";
import { getUsuarios, IUsuarioBasico } from "@/services/usuarioService";

export default function Proveedores() {
  const [proveedores, setProveedores] = useState<IProveedor[]>([]);
  const [usuarios, setUsuarios] = useState<IUsuarioBasico[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<IProveedor | null>(
    null,
  );
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [usuarioId, setUsuarioId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    fetchProveedores();
    fetchUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsuarios = async () => {
    try {
      const response = await getUsuarios();
      setUsuarios(response);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      showMessage("Error al cargar los usuarios", "error");
    }
  };

  const fetchProveedores = async () => {
    setLoading(true);
    try {
      const response = await getProveedores();
      setProveedores(response);
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
      showMessage("Error al cargar los proveedores", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      showMessage("El nombre es obligatorio", "error");
      return;
    }

    setSaving(true);
    try {
      const proveedorData: IProveedorCreate | IProveedorUpdate = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        direccion: direccion.trim() || undefined,
        telefono: telefono.trim() || undefined,
        usuarioId: usuarioId || undefined,
      };

      if (selectedProveedor) {
        await updateProveedor(
          selectedProveedor.id,
          proveedorData as IProveedorUpdate,
        );
        showMessage("Proveedor actualizado exitosamente", "success");
      } else {
        await createProveedor(proveedorData as IProveedorCreate);
        showMessage("Proveedor creado exitosamente", "success");
      }

      await fetchProveedores();
      handleClose();
    } catch (error) {
      console.error("Error al guardar proveedor:", error);
      const errorMessage =
        error.response?.data?.error || "Error al guardar el proveedor";
      showMessage(errorMessage, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const proveedor = proveedores.find((p) => p.id === id);
    if (!proveedor) return;

    confirmDialog(
      `¿Estás seguro de que deseas eliminar el proveedor "${proveedor.nombre}"?`,
      async () => {
        try {
          await deleteProveedor(id);
          showMessage("Proveedor eliminado exitosamente", "success");
          await fetchProveedores();
        } catch (error) {
          console.error("Error al eliminar proveedor:", error);
          const errorMessage =
            error.response?.data?.error || "Error al eliminar el proveedor";
          showMessage(errorMessage, "error");
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const handleEdit = (proveedor: IProveedor) => {
    setSelectedProveedor(proveedor);
    setNombre(proveedor.nombre);
    setDescripcion(proveedor.descripcion || "");
    setDireccion(proveedor.direccion || "");
    setTelefono(proveedor.telefono || "");
    setUsuarioId(proveedor.usuarioId || "");
    setOpen(true);
  };

  const resetForm = () => {
    setSelectedProveedor(null);
    setNombre("");
    setDescripcion("");
    setDireccion("");
    setTelefono("");
    setUsuarioId("");
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const filteredProveedores = proveedores.filter(
    (proveedor) =>
      proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (proveedor.descripcion &&
        proveedor.descripcion.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  // Cálculos para estadísticas
  const totalProveedores = proveedores.length;
  const proveedoresConTelefono = proveedores.filter((p) => p.telefono).length;

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Proveedores" },
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar proveedores">
        <IconButton onClick={fetchProveedores} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      {!isMobile && (
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpen(true)}
          size="small"
        >
          Nuevo Proveedor
        </Button>
      )}
    </Stack>
  );

  return (
    <PageContainer
      title="Proveedores"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
    >
      {isMobile && (
        <Button
          variant="contained"
          startIcon={<Add />}
          fullWidth
          onClick={() => setOpen(true)}
          sx={{ minHeight: 52, mb: 2.5 }}
        >
          Nuevo Proveedor
        </Button>
      )}

      {/* Estadísticas */}
      <Box sx={{ mb: 3 }}>
        <StatStrip
          variant="card"
          stats={[
            { label: "Total de proveedores", value: totalProveedores },
            {
              label: "Con consignación activa",
              value: proveedoresConTelefono,
            },
          ]}
        />
      </Box>

      {/* Contenido principal */}
      <ContentCard
        title="Lista de Proveedores"
        subtitle={`${filteredProveedores.length} proveedor${filteredProveedores.length !== 1 ? "es" : ""} encontrado${filteredProveedores.length !== 1 ? "s" : ""}`}
        headerActions={
          <SelectableTextField
            size="small"
            fullWidth={isMobile}
            placeholder="Buscar proveedor…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: isMobile ? "100%" : 200 }}
          />
        }
        noPadding
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredProveedores.length === 0 ? (
          <Box sx={{ textAlign: "center", p: 4 }}>
            <LocalShipping
              sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchTerm
                ? "No se encontraron proveedores"
                : "No hay proveedores registrados"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm
                ? "Intenta con otros términos de búsqueda"
                : "Comienza agregando tu primer proveedor"}
            </Typography>
            {!searchTerm && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setOpen(true)}
              >
                Nuevo Proveedor
              </Button>
            )}
          </Box>
        ) : isMobile ? (
          // Un proveedor por fila en una sola caja — mismo criterio que
          // /configuracion/categorias y /configuracion/destinos-transferencia.
          <Box>
            {filteredProveedores.map((proveedor, index) => {
              const contacto = [proveedor.telefono, proveedor.direccion]
                .filter(Boolean)
                .join(" · ");
              return (
                <Box
                  key={proveedor.id}
                  onClick={() => handleEdit(proveedor)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    minHeight: 64,
                    pl: 2,
                    pr: 0.5,
                    py: 1.25,
                    cursor: "pointer",
                    ...(index > 0 && { borderTop: 1, borderColor: "divider" }),
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "1rem", fontWeight: 600 }}>
                      {proveedor.nombre}
                    </Typography>
                    <Typography
                      variant="body2"
                      color={contacto ? "text.secondary" : "text.disabled"}
                      sx={{ mt: 0.375, fontVariantNumeric: "tabular-nums" }}
                    >
                      {contacto || "Sin contacto"}
                    </Typography>
                  </Box>
                  <Tooltip title="Eliminar proveedor">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(proveedor.id);
                      }}
                      color="error"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Proveedor</TableCell>
                  <TableCell>Contacto</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProveedores.map((proveedor) => (
                  <TableRow
                    key={proveedor.id}
                    sx={{
                      cursor: "pointer",
                      "&:hover": {
                        backgroundColor: "semantic.surface.sunken",
                      },
                    }}
                  >
                    <TableCell onClick={() => handleEdit(proveedor)}>
                      <Typography variant="body2" fontWeight="medium">
                        {proveedor.nombre}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleEdit(proveedor)}>
                      {proveedor.telefono || proveedor.direccion ? (
                        <Stack spacing={0.5}>
                          {proveedor.telefono && (
                            <Box display="flex" alignItems="center" gap={1}>
                              <Phone fontSize="small" color="action" />
                              <Typography variant="body2">
                                {proveedor.telefono}
                              </Typography>
                            </Box>
                          )}
                          {proveedor.direccion && (
                            <Box display="flex" alignItems="center" gap={1}>
                              <LocationOn fontSize="small" color="action" />
                              <Typography variant="body2">
                                {proveedor.direccion}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Sin contacto
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="center"
                      >
                        <Tooltip title="Editar proveedor">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(proveedor);
                            }}
                            size="medium"
                            color="primary"
                            sx={{
                              width: 44,
                              height: 44,
                            }}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar proveedor">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(proveedor.id);
                            }}
                            size="medium"
                            color="error"
                            sx={{
                              width: 44,
                              height: 44,
                            }}
                          >
                            <Delete />
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

      {/* Dialog para crear/editar proveedor */}
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
          {selectedProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}
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
              label="Nombre del proveedor"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Distribuidora ABC, Proveedor XYZ..."
              disabled={saving}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Business fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Descripción"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional del proveedor..."
              disabled={saving}
              multiline
              rows={2}
            />

            <TextField
              fullWidth
              label="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: +1234567890"
              disabled={saving}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Phone fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección del proveedor..."
              disabled={saving}
              multiline
              rows={2}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationOn fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl fullWidth disabled={saving}>
              <InputLabel id="usuario-label">
                Usuario Asociado (Opcional)
              </InputLabel>
              <Select
                labelId="usuario-label"
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value as string)}
                label="Usuario Asociado (Opcional)"
                displayEmpty
              >
                <MenuItem value="">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PersonOff fontSize="small" color="disabled" />
                    <Typography variant="body2" color="text.secondary">
                      Sin usuario asignado
                    </Typography>
                  </Stack>
                </MenuItem>
                {usuarios.map((usuario) => (
                  <MenuItem key={usuario.id} value={usuario.id}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar sx={{ width: 24, height: 24 }}>
                        {usuario.nombre.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {usuario.nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{usuario.usuario}
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
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

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
