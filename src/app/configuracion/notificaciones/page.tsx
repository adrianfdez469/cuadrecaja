"use client";

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
  Stack,
  Tooltip,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from "@mui/material";
import {
  Edit,
  Delete,
  Add,
  Search,
  Refresh,
  PlayCircleOutline,
  Warning,
  Info,
  Campaign,
  Message,
} from "@mui/icons-material";
import { NotificationApiService } from "@/services/notificationApiService";
import {
  INotificacion,
  INotificacionFormData,
  INotificacionStats,
  NivelImportancia,
  TipoNotificacion,
} from "@/schemas/notificacion";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { StatStrip } from "@/components/StatStrip";
import { StatusPill } from "@/components/StatusPill";
import type { PillHue } from "@/components/StatusPill";
import { LoadingState } from "@/components/LoadingState";
import { ContentCard } from "@/components/ContentCard";
import SelectableTextField from "@/components/SelectableTextField";
import { useMessageContext } from "@/context/MessageContext";
import dayjs from "dayjs";
import { INegocio } from "@/schemas/negocio";

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<INotificacion[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedNotificacion, setSelectedNotificacion] =
    useState<INotificacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<INotificacionStats | null>(null);
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [usuarios, setUsuarios] = useState<any[]>([]);

  // Form data
  const [formData, setFormData] = useState<INotificacionFormData>({
    titulo: "",
    descripcion: "",
    fechaInicio: dayjs().format("YYYY-MM-DDTHH:mm"),
    fechaFin: dayjs().add(7, "day").format("YYYY-MM-DDTHH:mm"),
    nivelImportancia: "MEDIA",
    tipo: "NOTIFICACION",
    negociosDestino: [],
    usuariosDestino: [],
  });

  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { showMessage } = useMessageContext();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    fetchNotificaciones();
    fetchStats();
    fetchNegocios();
    fetchUsuarios();
  }, []);

  const fetchNotificaciones = async () => {
    setLoading(true);
    try {
      const data = await NotificationApiService.getAllNotifications();
      setNotificaciones(data);
    } catch (error) {
      console.error("Error al obtener las notificaciones", error);
      showMessage("Error al cargar las notificaciones", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await NotificationApiService.getNotificationStats();
      setStats(data);
    } catch (error) {
      console.error("Error al obtener estadísticas", error);
    }
  };

  const fetchNegocios = async () => {
    try {
      const response = await fetch("/api/negocio");
      const data = await response.json();
      setNegocios(data);
    } catch (error) {
      console.error("Error al obtener negocios", error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const response = await fetch("/api/usuarios");
      const data = await response.json();
      setUsuarios(data);
    } catch (error) {
      console.error("Error al obtener usuarios", error);
    }
  };

  const handleOpen = (notificacion: INotificacion | null = null) => {
    if (notificacion) {
      setSelectedNotificacion(notificacion);
      setFormData({
        titulo: notificacion.titulo,
        descripcion: notificacion.descripcion,
        fechaInicio: dayjs(notificacion.fechaInicio).format("YYYY-MM-DDTHH:mm"),
        fechaFin: dayjs(notificacion.fechaFin).format("YYYY-MM-DDTHH:mm"),
        nivelImportancia: notificacion.nivelImportancia,
        tipo: notificacion.tipo,
        negociosDestino: NotificationApiService.stringToArray(
          notificacion.negociosDestino,
        ),
        usuariosDestino: NotificationApiService.stringToArray(
          notificacion.usuariosDestino,
        ),
      });
    } else {
      setSelectedNotificacion(null);
      setFormData({
        titulo: "",
        descripcion: "",
        fechaInicio: dayjs().format("YYYY-MM-DDTHH:mm"),
        fechaFin: dayjs().add(7, "day").format("YYYY-MM-DDTHH:mm"),
        nivelImportancia: "MEDIA",
        tipo: "NOTIFICACION",
        negociosDestino: [],
        usuariosDestino: [],
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedNotificacion(null);
  };

  const handleDelete = async (id: string) => {
    confirmDialog(
      "¿Estás seguro de eliminar esta notificación?",
      async () => {
        try {
          await NotificationApiService.deleteNotification(id);
          showMessage("Notificación eliminada exitosamente", "success");
          fetchNotificaciones();
          fetchStats();
        } catch (error) {
          console.error("Error al eliminar la notificación", error);
          showMessage("Error al eliminar la notificación", "error");
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const handleSave = async () => {
    if (!formData.titulo.trim() || !formData.descripcion.trim()) {
      showMessage("El título y descripción son obligatorios", "warning");
      return;
    }

    if (new Date(formData.fechaInicio) >= new Date(formData.fechaFin)) {
      showMessage(
        "La fecha de inicio debe ser anterior a la fecha de fin",
        "warning",
      );
      return;
    }

    setSaving(true);
    try {
      if (selectedNotificacion) {
        await NotificationApiService.updateNotification(
          selectedNotificacion.id,
          formData,
        );
        showMessage("Notificación actualizada exitosamente", "success");
      } else {
        await NotificationApiService.createNotification(formData);
        showMessage("Notificación creada exitosamente", "success");
      }
      fetchNotificaciones();
      fetchStats();
      handleClose();
    } catch (error) {
      console.error("Error al guardar la notificación", error);
      showMessage("Error al guardar la notificación", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRunAutoCheck = async () => {
    try {
      await NotificationApiService.runAutomaticChecks();
      showMessage(
        "Verificaciones automáticas ejecutadas exitosamente",
        "success",
      );
      fetchNotificaciones();
      fetchStats();
    } catch (error) {
      console.error("Error al ejecutar verificaciones automáticas", error);
      showMessage("Error al ejecutar verificaciones automáticas", "error");
    }
  };

  const filteredNotificaciones = notificaciones.filter(
    (notif) =>
      notif.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.tipo.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getTipoIcon = (tipo: TipoNotificacion) => {
    switch (tipo) {
      case "ALERTA":
        return <Warning color="error" />;
      case "PROMOCION":
        return <Campaign color="secondary" />;
      case "MENSAJE":
        return <Message color="primary" />;
      default:
        return <Info color="info" />;
    }
  };

  /** The stored enum shouts; the column does not have to. */
  const IMPORTANCE: Record<NivelImportancia, { label: string; hue: PillHue }> =
    {
      CRITICA: { label: "Crítica", hue: "negative" },
      ALTA: { label: "Alta", hue: "caution" },
      MEDIA: { label: "Media", hue: "info" },
      BAJA: { label: "Baja", hue: "neutral" },
    };

  const TIPO_LABELS: Record<TipoNotificacion, string> = {
    ALERTA: "Alerta",
    NOTIFICACION: "Notificación",
    PROMOCION: "Promoción",
    MENSAJE: "Mensaje",
  };

  const isActive = (notificacion: INotificacion) => {
    const ahora = new Date();
    return (
      ahora >= new Date(notificacion.fechaInicio) &&
      ahora <= new Date(notificacion.fechaFin)
    );
  };

  const breadcrumbs = [
    { label: "Inicio", href: "/home" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Notificaciones" },
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Ejecutar verificaciones automáticas">
        <IconButton
          onClick={handleRunAutoCheck}
          disabled={loading}
          size="small"
        >
          <PlayCircleOutline />
        </IconButton>
      </Tooltip>
      <Tooltip title="Actualizar notificaciones">
        <IconButton
          onClick={fetchNotificaciones}
          disabled={loading}
          size="small"
        >
          <Refresh />
        </IconButton>
      </Tooltip>
      <Button
        variant="contained"
        startIcon={!isMobile ? <Add /> : undefined}
        onClick={() => handleOpen()}
        size="small"
      >
        {isMobile ? "Agregar" : "Agregar Notificación"}
      </Button>
    </Stack>
  );

  return (
    <PageContainer
      title="Gestión de Notificaciones"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
    >
      {ConfirmDialogComponent}

      {/* The four counts, bare on the page ground. They were four bordered
          cards, each figure in a different hue — the total in violet, so the
          number that means nothing in particular was the one painted like an
          action. Only «Activas» and «No leídas» carry a verdict. */}
      {stats && (
        <StatStrip
          stats={[
            { label: "Total Notificaciones", value: stats.total },
            { label: "Activas", value: stats.activas, tone: "positive" },
            {
              label: `Leídas (${stats.porcentajeLeidas}%)`,
              value: stats.leidas,
            },
            {
              label: "No Leídas",
              value: stats.noLeidas,
              tone: stats.noLeidas > 0 ? "negative" : undefined,
            },
          ]}
        />
      )}

      {/* Tabla de Notificaciones */}
      <ContentCard>
        <Box sx={{ mb: 2 }}>
          <SelectableTextField
            fullWidth
            variant="outlined"
            placeholder="Buscar notificaciones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {loading ? (
          <LoadingState variant="table" />
        ) : isMobile ? (
          // `rediseno/notificaciones-movil.html`: título primero, fechas al
          // pie — una card por notificación, no la tabla de escritorio
          // recortada.
          <Stack spacing={1.5}>
            {filteredNotificaciones.map((notificacion) => (
              <Box
                key={notificacion.id}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1.5,
                  p: 2,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  {getTipoIcon(notificacion.tipo)}
                  <Typography variant="caption" color="text.secondary">
                    {TIPO_LABELS[notificacion.tipo] || notificacion.tipo}
                  </Typography>
                  <StatusPill
                    label={
                      IMPORTANCE[notificacion.nivelImportancia]?.label ??
                      notificacion.nivelImportancia
                    }
                    hue={
                      IMPORTANCE[notificacion.nivelImportancia]?.hue ??
                      "neutral"
                    }
                  />
                  <StatusPill
                    label={isActive(notificacion) ? "Activa" : "Inactiva"}
                    hue={isActive(notificacion) ? "positive" : "neutral"}
                  />
                </Stack>

                <Typography sx={{ mt: 1, fontWeight: 700, fontSize: "1rem" }}>
                  {notificacion.titulo}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {notificacion.descripcion.substring(0, 50)}...
                </Typography>

                <Stack
                  spacing={0.375}
                  sx={{
                    mt: 1.5,
                    pt: 1.5,
                    borderTop: 1,
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Inicio:{" "}
                    {dayjs(notificacion.fechaInicio).format("DD/MM/YYYY HH:mm")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Fin:{" "}
                    {dayjs(notificacion.fechaFin).format("DD/MM/YYYY HH:mm")}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  justifyContent="flex-end"
                  sx={{
                    mt: 0.75,
                    pt: 0.75,
                    borderTop: 1,
                    borderColor: "divider",
                  }}
                >
                  <IconButton onClick={() => handleOpen(notificacion)}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDelete(notificacion.id)}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            ))}
            {filteredNotificaciones.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                No hay notificaciones para mostrar.
              </Typography>
            )}
          </Stack>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Título</TableCell>
                  <TableCell>Importancia</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Fecha Inicio</TableCell>
                  <TableCell>Fecha Fin</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredNotificaciones.map((notificacion) => (
                  <TableRow key={notificacion.id}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {getTipoIcon(notificacion.tipo)}
                        <Typography variant="body2">
                          {TIPO_LABELS[notificacion.tipo] || notificacion.tipo}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {notificacion.titulo}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {notificacion.descripcion.substring(0, 50)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={
                          IMPORTANCE[notificacion.nivelImportancia]?.label ??
                          notificacion.nivelImportancia
                        }
                        hue={
                          IMPORTANCE[notificacion.nivelImportancia]?.hue ??
                          "neutral"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={isActive(notificacion) ? "Activa" : "Inactiva"}
                        hue={isActive(notificacion) ? "positive" : "neutral"}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {dayjs(notificacion.fechaInicio).format(
                          "DD/MM/YYYY HH:mm",
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {dayjs(notificacion.fechaFin).format(
                          "DD/MM/YYYY HH:mm",
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => handleOpen(notificacion)}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(notificacion.id)}
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

      {/* Dialog para crear/editar notificación */}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedNotificacion
            ? "Editar Notificación"
            : "Crear Nueva Notificación"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Título"
                value={formData.titulo}
                onChange={(e) =>
                  setFormData({ ...formData, titulo: e.target.value })
                }
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descripción"
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData({ ...formData, descripcion: e.target.value })
                }
                multiline
                rows={3}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fecha de Inicio"
                type="datetime-local"
                value={formData.fechaInicio}
                onChange={(e) =>
                  setFormData({ ...formData, fechaInicio: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fecha de Fin"
                type="datetime-local"
                value={formData.fechaFin}
                onChange={(e) =>
                  setFormData({ ...formData, fechaFin: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={formData.tipo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipo: e.target.value as TipoNotificacion,
                    })
                  }
                  label="Tipo"
                >
                  <MenuItem value="ALERTA">Alerta</MenuItem>
                  <MenuItem value="NOTIFICACION">Notificación</MenuItem>
                  <MenuItem value="PROMOCION">Promoción</MenuItem>
                  <MenuItem value="MENSAJE">Mensaje</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Nivel de Importancia</InputLabel>
                <Select
                  value={formData.nivelImportancia}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nivelImportancia: e.target.value as NivelImportancia,
                    })
                  }
                  label="Nivel de Importancia"
                >
                  <MenuItem value="BAJA">Baja</MenuItem>
                  <MenuItem value="MEDIA">Media</MenuItem>
                  <MenuItem value="ALTA">Alta</MenuItem>
                  <MenuItem value="CRITICA">Crítica</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={negocios}
                getOptionLabel={(option) => option.nombre}
                value={negocios.filter((n) =>
                  formData.negociosDestino.includes(n.id),
                )}
                onChange={(_, newValue) => {
                  setFormData({
                    ...formData,
                    negociosDestino: newValue.map((n) => n.id),
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Negocios Destino (vacío = todos)"
                    placeholder="Seleccionar negocios..."
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={usuarios}
                getOptionLabel={(option) => option.nombre}
                value={usuarios.filter((u) =>
                  formData.usuariosDestino.includes(u.id),
                )}
                onChange={(_, newValue) => {
                  setFormData({
                    ...formData,
                    usuariosDestino: newValue.map((u) => u.id),
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Usuarios Destino (vacío = todos)"
                    placeholder="Seleccionar usuarios..."
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : undefined}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
