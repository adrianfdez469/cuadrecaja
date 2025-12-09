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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete
} from "@mui/material";
import { 
  Edit, 
  Delete, 
  Add,
  Search,
  Refresh,
  ExpandMore,
  ExpandLess,
  Warning,
  Info,
  Campaign,
  Message
} from "@mui/icons-material";
import { NotificationApiService } from "@/services/notificationApiService";
import { INotificacion, INotificacionFormData, INotificacionStats, NivelImportancia, TipoNotificacion } from "@/types/INotificacion";
import useConfirmDialog from "@/components/confirmDialog";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useMessageContext } from "@/context/MessageContext";
import dayjs from 'dayjs';
import { INegocio } from "@/types/INegocio";

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<INotificacion[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedNotificacion, setSelectedNotificacion] = useState<INotificacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [stats, setStats] = useState<INotificacionStats | null>(null);
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [usuarios, setUsuarios] = useState<any[]>([]);
  
  // Form data
  const [formData, setFormData] = useState<INotificacionFormData>({
    titulo: "",
    descripcion: "",
    fechaInicio: dayjs().format('YYYY-MM-DDTHH:mm'),
    fechaFin: dayjs().add(7, 'day').format('YYYY-MM-DDTHH:mm'),
    nivelImportancia: 'MEDIA',
    tipo: 'NOTIFICACION',
    negociosDestino: [],
    usuariosDestino: []
  });

  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { showMessage } = useMessageContext();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      const response = await fetch('/api/negocio');
      const data = await response.json();
      setNegocios(data);
    } catch (error) {
      console.error("Error al obtener negocios", error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const response = await fetch('/api/usuarios');
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
        fechaInicio: dayjs(notificacion.fechaInicio).format('YYYY-MM-DDTHH:mm'),
        fechaFin: dayjs(notificacion.fechaFin).format('YYYY-MM-DDTHH:mm'),
        nivelImportancia: notificacion.nivelImportancia,
        tipo: notificacion.tipo,
        negociosDestino: NotificationApiService.stringToArray(notificacion.negociosDestino),
        usuariosDestino: NotificationApiService.stringToArray(notificacion.usuariosDestino)
      });
    } else {
      setSelectedNotificacion(null);
      setFormData({
        titulo: "",
        descripcion: "",
        fechaInicio: dayjs().format('YYYY-MM-DDTHH:mm'),
        fechaFin: dayjs().add(7, 'day').format('YYYY-MM-DDTHH:mm'),
        nivelImportancia: 'MEDIA',
        tipo: 'NOTIFICACION',
        negociosDestino: [],
        usuariosDestino: []
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedNotificacion(null);
  };

  const handleDelete = async (id: string) => {
    confirmDialog("¿Estás seguro de eliminar esta notificación?", async () => {
      try {
        await NotificationApiService.deleteNotification(id);
        showMessage("Notificación eliminada exitosamente", "success");
        fetchNotificaciones();
        fetchStats();
      } catch (error) {
        console.error("Error al eliminar la notificación", error);
        showMessage("Error al eliminar la notificación", "error");
      }
    });
  };

  const handleSave = async () => {
    if (!formData.titulo.trim() || !formData.descripcion.trim()) {
      showMessage("El título y descripción son obligatorios", "warning");
      return;
    }

    if (new Date(formData.fechaInicio) >= new Date(formData.fechaFin)) {
      showMessage("La fecha de inicio debe ser anterior a la fecha de fin", "warning");
      return;
    }

    setSaving(true);
    try {
      if (selectedNotificacion) {
        await NotificationApiService.updateNotification(selectedNotificacion.id, formData);
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
      showMessage("Verificaciones automáticas ejecutadas exitosamente", "success");
      fetchNotificaciones();
      fetchStats();
    } catch (error) {
      console.error("Error al ejecutar verificaciones automáticas", error);
      showMessage("Error al ejecutar verificaciones automáticas", "error");
    }
  };

  const filteredNotificaciones = notificaciones.filter((notif) =>
    notif.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notif.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notif.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoIcon = (tipo: TipoNotificacion) => {
    switch (tipo) {
      case 'ALERTA':
        return <Warning color="error" />;
      case 'PROMOCION':
        return <Campaign color="secondary" />;
      case 'MENSAJE':
        return <Message color="primary" />;
      default:
        return <Info color="info" />;
    }
  };

  const getImportanceColor = (nivel: NivelImportancia) => {
    switch (nivel) {
      case 'CRITICA':
        return 'error';
      case 'ALTA':
        return 'warning';
      case 'MEDIA':
        return 'info';
      default:
        return 'success';
    }
  };

  const isActive = (notificacion: INotificacion) => {
    const ahora = new Date();
    return ahora >= new Date(notificacion.fechaInicio) && ahora <= new Date(notificacion.fechaFin);
  };

  const breadcrumbs = [
    { label: 'Inicio', href: '/home' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Notificaciones' }
  ];

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Ejecutar verificaciones automáticas">
        <IconButton onClick={handleRunAutoCheck} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      <Tooltip title="Actualizar notificaciones">
        <IconButton onClick={fetchNotificaciones} disabled={loading} size="small">
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

      {/* Estadísticas */}
      {stats && (
        <Collapse in={!isMobile || statsExpanded}>
          <ContentCard>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {stats.total}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Notificaciones
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="success.main">
                      {stats.activas}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Activas
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="warning.main">
                      {stats.leidas}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Leídas ({stats.porcentajeLeidas}%)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="error.main">
                      {stats.noLeidas}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      No Leídas
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </ContentCard>
        </Collapse>
      )}

      {/* Tabla de Notificaciones */}
      <ContentCard>
        <Box sx={{ mb: 2 }}>
          <TextField
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
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
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
                          {notificacion.tipo}
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
                      <Chip
                        label={notificacion.nivelImportancia}
                        color={getImportanceColor(notificacion.nivelImportancia)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={isActive(notificacion) ? "Activa" : "Inactiva"}
                        color={isActive(notificacion) ? "success" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {dayjs(notificacion.fechaInicio).format('DD/MM/YYYY HH:mm')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {dayjs(notificacion.fechaFin).format('DD/MM/YYYY HH:mm')}
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
          {selectedNotificacion ? "Editar Notificación" : "Crear Nueva Notificación"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Título"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descripción"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoNotificacion })}
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
                  onChange={(e) => setFormData({ ...formData, nivelImportancia: e.target.value as NivelImportancia })}
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
                value={negocios.filter(n => formData.negociosDestino.includes(n.id))}
                onChange={(_, newValue) => {
                  setFormData({
                    ...formData,
                    negociosDestino: newValue.map(n => n.id)
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
                value={usuarios.filter(u => formData.usuariosDestino.includes(u.id))}
                onChange={(_, newValue) => {
                  setFormData({
                    ...formData,
                    usuariosDestino: newValue.map(u => u.id)
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
