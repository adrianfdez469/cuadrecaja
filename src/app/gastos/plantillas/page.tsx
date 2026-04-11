"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { usePermisos } from "@/utils/permisos_front";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import useConfirmDialog from "@/components/confirmDialog";
import {
  IGastoPlantilla,
  ICreateGastoPlantilla,
  ICreateGastoTienda,
} from "@/schemas/gastos";
import {
  getPlantillas,
  createPlantilla,
  updatePlantilla,
  deletePlantilla,
} from "@/services/gastoService";
import {
  TIPO_CALCULO_LABELS,
  TIPO_CALCULO_COLORS,
  RECURRENCIA_LABELS,
  RECURRENCIA_COLORS,
} from "@/constants/gastos";
import { formatearCuandoAplica } from "@/utils/gastos";
import GastoFormDialog from "../components/GastoFormDialog";

type PlantillaConCount = IGastoPlantilla & { _count?: { asignaciones: number } };

export default function PlantillasPage() {
  const { loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { verificarPermiso } = usePermisos();

  const canManage = verificarPermiso("configuracion.gastos.plantillas.gestionar");

  const [plantillas, setPlantillas] = useState<PlantillaConCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IGastoPlantilla | null>(null);

  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlantillas();
      setPlantillas(data as PlantillaConCount[]);
    } catch {
      showMessage("Error al cargar plantillas", "error");
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    if (!loadingContext && canManage) load();
  }, [loadingContext, canManage, load]);

  const handleSave = async (data: ICreateGastoPlantilla | ICreateGastoTienda) => {
    try {
      if (editTarget) {
        await updatePlantilla(editTarget.id, data as ICreateGastoPlantilla);
        showMessage("Plantilla actualizada", "success");
      } else {
        await createPlantilla(data as ICreateGastoPlantilla);
        showMessage("Plantilla creada", "success");
      }
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showMessage(msg ?? "Error al guardar plantilla", "error");
      throw err;
    }
  };

  const handleDelete = (p: PlantillaConCount) => {
    const tiendas = p._count?.asignaciones ?? 0;
    confirmDialog(
      tiendas > 0
        ? `Esta plantilla tiene ${tiendas} tienda(s) con gastos activos. ¿Deseas eliminarla de todos modos? Primero debes desactivar esas asignaciones.`
        : `¿Eliminar la plantilla "${p.nombre}"?`,
      async () => {
        try {
          await deletePlantilla(p.id);
          showMessage("Plantilla eliminada", "success");
          await load();
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          showMessage(msg ?? "Error al eliminar plantilla", "error");
        }
      }
    );
  };

  if (!loadingContext && !canManage) {
    return (
      <PageContainer title="Plantillas de Gastos">
        <Alert severity="error">No tienes permisos para acceder a esta sección.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Plantillas de Gastos">
      <ContentCard
        title="Plantillas de gastos"
        subtitle="Plantillas a nivel de negocio que pueden asignarse a tiendas específicas"
        headerActions={
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            Nueva plantilla
          </Button>
        }
      >
        {loading ? (
          <Box py={4} textAlign="center"><CircularProgress size={32} /></Box>
        ) : isMobile ? (
          <Stack spacing={1.5} sx={{ p: 0.5 }}>
            {plantillas.length === 0 ? (
              <Box py={4} textAlign="center">
                <Typography color="text.secondary">No hay plantillas creadas</Typography>
              </Box>
            ) : (
              plantillas.map((p) => (
                <Card key={p.id} sx={{ opacity: p.activo ? 1 : 0.6 }}>
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1} mr={1}>
                          <Typography variant="subtitle2" fontWeight="bold">{p.nombre}</Typography>
                          <Typography variant="caption" color="text.secondary">{p.categoria}</Typography>
                        </Box>
                        <Chip
                          label={RECURRENCIA_LABELS[p.recurrencia]}
                          size="small"
                          sx={{ backgroundColor: RECURRENCIA_COLORS[p.recurrencia], color: "#fff", height: 20, fontSize: "0.6875rem" }}
                        />
                      </Box>
                      <Box display="flex" gap={1} alignItems="center">
                        <Chip
                          label={TIPO_CALCULO_LABELS[p.tipoCalculo]}
                          size="small"
                          sx={{ backgroundColor: TIPO_CALCULO_COLORS[p.tipoCalculo], color: "#fff", height: 20, fontSize: "0.6875rem" }}
                        />
                        {(p._count?.asignaciones ?? 0) > 0 && (
                          <Chip
                            icon={<LinkIcon />}
                            label={`${p._count?.asignaciones} tienda(s)`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.6875rem" }}
                          />
                        )}
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">{formatearCuandoAplica(p)}</Typography>
                        <Box>
                          <IconButton size="small" onClick={() => { setEditTarget(p); setFormOpen(true); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(p)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell>Tipo de cálculo</TableCell>
                  <TableCell>Recurrencia</TableCell>
                  <TableCell>Cuándo aplica</TableCell>
                  <TableCell>Tiendas asignadas</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plantillas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" py={2}>No hay plantillas creadas</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  plantillas.map((p) => (
                    <TableRow key={p.id} sx={{ opacity: p.activo ? 1 : 0.5 }}>
                      <TableCell>{p.nombre}</TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{p.categoria}</Typography></TableCell>
                      <TableCell>
                        <Chip
                          label={TIPO_CALCULO_LABELS[p.tipoCalculo]}
                          size="small"
                          sx={{ backgroundColor: TIPO_CALCULO_COLORS[p.tipoCalculo], color: "#fff", fontSize: "0.6875rem" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={RECURRENCIA_LABELS[p.recurrencia]}
                          size="small"
                          sx={{ backgroundColor: RECURRENCIA_COLORS[p.recurrencia], color: "#fff", fontSize: "0.6875rem" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{formatearCuandoAplica(p)}</Typography>
                      </TableCell>
                      <TableCell>
                        {(p._count?.asignaciones ?? 0) > 0 ? (
                          <Tooltip title="Tiendas con este gasto activo">
                            <Chip
                              icon={<LinkIcon />}
                              label={`${p._count?.asignaciones}`}
                              size="small"
                              variant="outlined"
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">Sin asignar</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => { setEditTarget(p); setFormOpen(true); }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(p)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      <GastoFormDialog
        open={formOpen}
        mode="plantilla"
        initial={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSave={handleSave}
      />

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
