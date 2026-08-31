"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
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
import { RECURRENCIA_LABELS, TIPO_CALCULO_LABELS } from "@/constants/gastos";
import { formatearCuandoAplica } from "@/utils/gastos";
import GastoFormDialog from "../components/GastoFormDialog";
import PlantillaCard from "../components/PlantillaCard";

type PlantillaConCount = IGastoPlantilla & {
  _count?: { asignaciones: number };
};

export default function PlantillasPage() {
  const { loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { verificarPermiso } = usePermisos();

  const canManage = verificarPermiso(
    "configuracion.gastos.plantillas.gestionar",
  );

  const [plantillas, setPlantillas] = useState<PlantillaConCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IGastoPlantilla | null>(null);

  const categoriasExistentes = [...new Set(plantillas.map((p) => p.categoria))];

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

  const handleSave = async (
    data: ICreateGastoPlantilla | ICreateGastoTienda,
  ) => {
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
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
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
          const msg = (err as { response?: { data?: { error?: string } } })
            ?.response?.data?.error;
          showMessage(msg ?? "Error al eliminar plantilla", "error");
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  if (!loadingContext && !canManage) {
    return (
      <PageContainer title="Plantillas de Gastos">
        <Alert severity="error">
          No tienes permisos para acceder a esta sección.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Plantillas de Gastos">
      <ContentCard
        title="Plantillas de gastos"
        subtitle="Plantillas a nivel de negocio que pueden asignarse a tiendas específicas"
        headerActions={
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            Nueva plantilla
          </Button>
        }
      >
        {loading ? (
          <Box py={4} textAlign="center">
            <CircularProgress size={32} />
          </Box>
        ) : isMobile ? (
          <Stack spacing={1.5}>
            {plantillas.length === 0 ? (
              <Box py={4} textAlign="center">
                <Typography color="text.secondary">
                  No hay plantillas creadas
                </Typography>
              </Box>
            ) : (
              plantillas.map((p) => (
                <PlantillaCard
                  key={p.id}
                  plantilla={p}
                  onEdit={(plantilla) => {
                    setEditTarget(plantilla);
                    setFormOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))
            )}
          </Stack>
        ) : (
          <TableContainer>
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
                      <Typography color="text.secondary" py={2}>
                        No hay plantillas creadas
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  plantillas.map((p) => (
                    <TableRow key={p.id} sx={{ opacity: p.activo ? 1 : 0.5 }}>
                      <TableCell>{p.nombre}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {p.categoria}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {TIPO_CALCULO_LABELS[p.tipoCalculo]}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {RECURRENCIA_LABELS[p.recurrencia]}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatearCuandoAplica(p)}
                        </Typography>
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
                          <Typography variant="caption" color="text.disabled">
                            Sin asignar
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditTarget(p);
                            setFormOpen(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(p)}
                        >
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
        categoriasExistentes={categoriasExistentes}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSave={handleSave}
      />

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
