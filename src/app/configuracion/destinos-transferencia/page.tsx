"use client";

import React, { useState, useEffect } from "react";
import { StatStrip } from "@/components/StatStrip";
import { StatusPill } from "@/components/StatusPill";
import { touch } from "@/theme";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  Stack,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
} from "@mui/material";
import {
  Delete,
  Add,
  AccountBalance,
  Star,
  Search,
  Refresh,
  Close,
} from "@mui/icons-material";
import {
  fetchTransferDestinations,
  createTransferDestination,
  updateTransferDestination,
  deleteTransferDestination,
} from "@/services/transferDestinationsService";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { LoadingState } from "@/components/LoadingState";
import { ContentCard } from "@/components/ContentCard";
import SelectableTextField from "@/components/SelectableTextField";
import { useAppContext } from "@/context/AppContext";
import { ITransferDestination } from "@/schemas/transferDestination";

export default function DestinosTransferenciaPage() {
  const [destinations, setDestinations] = useState<ITransferDestination[]>([]);
  const [open, setOpen] = useState(false);
  const [editingDestination, setEditingDestination] =
    useState<ITransferDestination | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { user } = useAppContext();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (user?.localActual?.id) {
      loadDestinations();
    }
  }, [user?.localActual?.id]);

  const loadDestinations = async () => {
    if (!user?.localActual?.id) return;

    setLoading(true);
    try {
      const data = await fetchTransferDestinations(user.localActual.id);
      setDestinations(data);
    } catch (error) {
      console.error("Error al cargar destinos de transferencia:", error);
      showMessage("Error al cargar destinos de transferencia", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (destination: ITransferDestination | null = null) => {
    setEditingDestination(destination);
    setNombre(destination ? destination.nombre : "");
    setDescripcion(destination ? destination.descripcion || "" : "");
    setIsDefault(destination ? destination.default : false);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingDestination(null);
    setNombre("");
    setDescripcion("");
    setIsDefault(false);
  };

  const handleSave = async () => {
    if (!user?.localActual?.id) {
      showMessage("No hay un local seleccionado", "error");
      return;
    }

    try {
      if (editingDestination) {
        await updateTransferDestination(
          editingDestination.id,
          nombre,
          descripcion,
          isDefault,
        );
        showMessage(
          "Destino de transferencia actualizado exitosamente",
          "success",
        );
      } else {
        await createTransferDestination(
          nombre,
          descripcion,
          isDefault,
          user.localActual.id,
        );
        showMessage("Destino de transferencia creado exitosamente", "success");
      }
      await loadDestinations();
      handleClose();
    } catch (error) {
      console.error("Error al guardar destino de transferencia:", error);
      showMessage("Error al guardar el destino de transferencia", "error");
    }
  };

  const handleDelete = async (id: string) => {
    confirmDialog(
      "¿Está seguro que desea eliminar el destino de transferencia?",
      async () => {
        try {
          await deleteTransferDestination(id);
          showMessage("Destino de transferencia eliminado", "success");
        } catch (error) {
          console.error(error);
          showMessage(
            "Error al intentar eliminar el destino de transferencia. Es probable que esté en uso!",
            "error",
          );
        } finally {
          await loadDestinations();
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const filteredDestinations = destinations.filter(
    (destination) =>
      destination.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (destination.descripcion &&
        destination.descripcion
          .toLowerCase()
          .includes(searchTerm.toLowerCase())),
  );

  // Cálculos para estadísticas
  const totalDestinations = destinations.length;
  const defaultDestinations = destinations.filter((d) => d.default).length;
  const destinationsWithDescription = destinations.filter(
    (d) => d.descripcion,
  ).length;
  const destinationsVisible = filteredDestinations.length;

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Destinos de Transferencia" },
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar destinos">
        <IconButton onClick={loadDestinations} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      {!isMobile && (
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpen()}
          size="small"
          disabled={!user?.localActual?.id}
        >
          Agregar Destino
        </Button>
      )}
    </Stack>
  );

  // Componente de estadística móvil optimizado
  if (!user?.localActual?.id) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <Typography variant="h6" color="text.secondary">
          Selecciona un local para gestionar los destinos de transferencia
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <PageContainer
        title="Gestión de Destinos de Transferencia"
        breadcrumbs={breadcrumbs}
        maxWidth="xl"
      >
        <LoadingState variant="table" />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Gestión de Destinos de Transferencia"
      subtitle={
        !isMobile
          ? "Configura los destinos para las transferencias de tu local"
          : undefined
      }
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {isMobile && (
        <Button
          variant="contained"
          startIcon={<Add />}
          fullWidth
          onClick={() => handleOpen()}
          disabled={!user?.localActual?.id}
          sx={{ minHeight: touch.comfortable, mb: 2.5 }}
        >
          Agregar Destino
        </Button>
      )}

      <StatStrip
        stats={[
          {
            label: "Total Destinos",
            value: totalDestinations.toLocaleString(),
          },
          { label: "Por Defecto", value: defaultDestinations.toLocaleString() },
          {
            label: "Con Descripción",
            value: destinationsWithDescription.toLocaleString(),
          },
          { label: "Visibles", value: destinationsVisible.toLocaleString() },
        ]}
      />

      {/* Lista de destinos */}
      <ContentCard
        title="Lista de Destinos"
        subtitle={
          !isMobile ? "Haz clic en cualquier destino para editarlo" : undefined
        }
        headerActions={
          <SelectableTextField
            size="small"
            placeholder={isMobile ? "Buscar..." : "Buscar destino..."}
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
              maxWidth: isMobile ? 200 : "none",
            }}
          />
        }
        noPadding
        fullHeight
      >
        {filteredDestinations.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Box sx={{ textAlign: "center", py: 8 }}>
              <AccountBalance
                sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary">
                {searchTerm
                  ? "No se encontraron destinos"
                  : "No hay destinos registrados"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm
                  ? "Intenta con otros términos de búsqueda"
                  : "Agrega destinos para configurar las transferencias"}
              </Typography>
            </Box>
          </Box>
        ) : isMobile ? (
          // Un destino por fila en una sola caja — no una tarjeta por fila
          // (mismo criterio que /configuracion/categorias: la tarjeta
          // dentro de tarjeta cuesta un borde y una sangría por fila).
          <Box>
            {filteredDestinations.map((destination, index) => (
              <Box
                key={destination.id}
                onClick={() => handleOpen(destination)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  minHeight: 72,
                  pl: 2,
                  pr: 0.5,
                  py: 1.25,
                  cursor: "pointer",
                  ...(index > 0 && { borderTop: 1, borderColor: "divider" }),
                }}
              >
                <AccountBalance
                  sx={{ color: "text.secondary", flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 600 }}>
                    {destination.nombre}
                  </Typography>
                  {destination.descripcion && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.375 }}
                    >
                      {destination.descripcion}
                    </Typography>
                  )}
                  {destination.default && (
                    <Box sx={{ mt: 0.75 }}>
                      <StatusPill label="Por Defecto" hue="caution" />
                    </Box>
                  )}
                </Box>
                <Tooltip title="Eliminar">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(destination.id);
                    }}
                    color="error"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell>Por Defecto</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDestinations.map((destination) => (
                  <TableRow
                    key={destination.id}
                    onClick={() => handleOpen(destination)}
                    sx={{
                      cursor: "pointer",
                      "&:hover": {
                        backgroundColor: "semantic.surface.sunken",
                      },
                    }}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <AccountBalance color="primary" />
                        <Typography variant="body2" fontWeight="medium">
                          {destination.nombre}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {destination.descripcion || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {destination.default ? (
                        <Chip
                          icon={<Star />}
                          label="Por Defecto"
                          color="warning"
                          size="small"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Eliminar">
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(destination.id);
                          }}
                          size="small"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Modal de edición/creación */}
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
          {editingDestination
            ? "Editar Destino de Transferencia"
            : "Nuevo Destino de Transferencia"}
          {isMobile && (
            <IconButton onClick={handleClose}>
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Tarjeta Principal, Cuenta Bancaria..."
            />

            <TextField
              fullWidth
              label="Descripción"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              multiline
              rows={3}
              placeholder="Descripción opcional del destino..."
            />

            <FormControlLabel
              control={
                <Switch
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  color="warning"
                />
              }
              label="Marcar como destino por defecto"
            />
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
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!nombre.trim()}
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: isMobile ? 56 : undefined }}
          >
            {editingDestination ? "Actualizar" : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
